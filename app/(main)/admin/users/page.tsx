import { UsersClient } from "./users-client"
import { searchUsers } from "@/app/api/admin/users/actions"

export default async function AdminUsersPage() {
  // Fetch initial 50 users (page 1)
  const result = await searchUsers({}, 1, 50)

  return (
    <UsersClient
      initialUsers={result.data}
      initialTotalCount={result.totalCount}
      initialTotalPages={result.totalPages}
      initialPage={result.currentPage}
    />
  )
}
