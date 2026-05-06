/**
 * 🏦 PAYMENTS SERVICE
 *
 * Servicio centralizado para gestión de pagos de inscripciones.
 * Los pagos son independientes de la aprobación de inscripciones.
 */

export {
  ensurePaymentRecords,
  updatePaymentStatus,
  ensurePaymentRecordsBulk,
  type PaymentRecord,
  type CreatePaymentRecordsParams,
  type UpdatePaymentStatusParams
} from './payment-records';

export {
  getInscriptionPayments,
  getTournamentPaymentsSummary,
  type PaymentStatus,
  type InscriptionPaymentInfo
} from './payment-queries';
