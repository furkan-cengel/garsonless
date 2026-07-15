// Compatibility re-export. The vocabulary belongs to the browser-safe domain
// package; legacy call-sites can keep importing it from @garsonless/db while
// the strangler migration proceeds.
export {
  SERVICE_REQUEST_TYPES,
  SERVICE_REQUEST_LABELS,
  isServiceRequestType,
  serviceRequestLabel,
} from '@garsonless/domain/tables'
export type { ServiceRequestType } from '@garsonless/domain/tables'
