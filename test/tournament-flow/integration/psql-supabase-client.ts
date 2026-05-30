import { execFileSync } from 'child_process'

type Condition = {
  column: string
  operator: '=' | 'is' | 'in'
  value: any
}

type OrderBy = {
  column: string
  ascending: boolean
}

const DOCKER_ARGS = [
  'exec',
  '-i',
  'supabase_db_padel-base',
  'psql',
  '-U',
  'postgres',
  '-d',
  'postgres',
  '-q',
  '-t',
  '-A',
  '-v',
  'ON_ERROR_STOP=1',
]

const quoteIdentifier = (identifier: string) => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`)
  }

  return `"${identifier}"`
}

const sqlValue = (value: any): string => {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return `'${String(value).replace(/'/g, "''")}'`
}

const selectedColumns = (columns: string | null) => {
  if (!columns || columns.trim() === '*') return '*'

  return columns
    .split(',')
    .map((column) => quoteIdentifier(column.trim()))
    .join(', ')
}

export const execSql = (sql: string) => {
  return execFileSync('docker', DOCKER_ARGS, {
    input: sql,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim()
}

export const canUseLocalSupabaseDb = () => {
  try {
    execSql('select 1;')
    return true
  } catch {
    return false
  }
}

export const readJson = <T>(sql: string): T => {
  const output = execSql(sql)
  return JSON.parse(output || 'null') as T
}

class PsqlQueryBuilder {
  private selected: string | null = null
  private operation: 'select' | 'insert' | 'delete' | 'update' = 'select'
  private conditions: Condition[] = []
  private orderBy: OrderBy | null = null
  private limitCount: number | null = null
  private rows: any[] = []
  private updateValues: Record<string, any> | null = null

  constructor(private readonly table: string) {}

  select(columns = '*') {
    this.selected = columns
    return this
  }

  eq(column: string, value: any) {
    this.conditions.push({ column, operator: '=', value })
    return this
  }

  is(column: string, value: any) {
    this.conditions.push({ column, operator: 'is', value })
    return this
  }

  in(column: string, value: any[]) {
    this.conditions.push({ column, operator: 'in', value })
    return this
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orderBy = { column, ascending: options.ascending !== false }
    return this
  }

  limit(count: number) {
    this.limitCount = count
    return this
  }

  insert(rows: any | any[]) {
    this.operation = 'insert'
    this.rows = Array.isArray(rows) ? rows : [rows]
    return this
  }

  delete() {
    this.operation = 'delete'
    return this
  }

  update(values: Record<string, any>) {
    this.operation = 'update'
    this.updateValues = values
    return this
  }

  async maybeSingle() {
    const result = await this.execute()
    if (result.error) return result
    return { data: result.data?.[0] ?? null, error: null }
  }

  async single() {
    const result = await this.execute()
    if (result.error) return result
    return { data: result.data?.[0] ?? null, error: null }
  }

  then(resolve: any, reject: any) {
    return this.execute().then(resolve, reject)
  }

  private whereClause() {
    if (this.conditions.length === 0) return ''

    const clauses = this.conditions.map((condition) => {
      const column = quoteIdentifier(condition.column)

      if (condition.operator === 'is') {
        return `${column} is ${sqlValue(condition.value)}`
      }

      if (condition.operator === 'in') {
        return `${column} in (${condition.value.map(sqlValue).join(', ')})`
      }

      return `${column} = ${sqlValue(condition.value)}`
    })

    return ` where ${clauses.join(' and ')}`
  }

  private selectSql() {
    const order = this.orderBy
      ? ` order by ${quoteIdentifier(this.orderBy.column)} ${this.orderBy.ascending ? 'asc' : 'desc'}`
      : ''
    const limit = this.limitCount ? ` limit ${this.limitCount}` : ''

    return `
      select coalesce(json_agg(row_to_json(q)), '[]'::json)
      from (
        select ${selectedColumns(this.selected)}
        from public.${quoteIdentifier(this.table)}
        ${this.whereClause()}
        ${order}
        ${limit}
      ) q;
    `
  }

  private insertSql() {
    if (this.rows.length === 0) {
      return `select '[]'::json;`
    }

    const columns = Object.keys(this.rows[0])
    const values = this.rows
      .map((row) => `(${columns.map((column) => sqlValue(row[column])).join(', ')})`)
      .join(', ')

    return `
      with inserted as (
        insert into public.${quoteIdentifier(this.table)} (${columns.map(quoteIdentifier).join(', ')})
        values ${values}
        returning ${selectedColumns(this.selected)}
      )
      select coalesce(json_agg(row_to_json(inserted)), '[]'::json) from inserted;
    `
  }

  private deleteSql() {
    return `
      with deleted as (
        delete from public.${quoteIdentifier(this.table)}
        ${this.whereClause()}
        returning ${selectedColumns(this.selected)}
      )
      select coalesce(json_agg(row_to_json(deleted)), '[]'::json) from deleted;
    `
  }

  private updateSql() {
    const values = this.updateValues || {}
    const assignments = Object.entries(values)
      .map(([column, value]) => `${quoteIdentifier(column)} = ${sqlValue(value)}`)
      .join(', ')

    return `
      with updated as (
        update public.${quoteIdentifier(this.table)}
        set ${assignments}
        ${this.whereClause()}
        returning ${selectedColumns(this.selected)}
      )
      select coalesce(json_agg(row_to_json(updated)), '[]'::json) from updated;
    `
  }

  private async execute() {
    try {
      const sql = this.operation === 'insert'
        ? this.insertSql()
        : this.operation === 'delete'
          ? this.deleteSql()
          : this.operation === 'update'
            ? this.updateSql()
            : this.selectSql()

      return { data: readJson<any[]>(sql), error: null }
    } catch (error: any) {
      return {
        data: null,
        error: {
          message: error?.stderr?.toString?.() || error?.message || 'psql error',
          code: 'PSQL_ERROR',
        },
      }
    }
  }
}

export const createPsqlSupabaseClient = () => ({
  from: (table: string) => new PsqlQueryBuilder(table),
})
