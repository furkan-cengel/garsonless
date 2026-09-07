let loggingOut = false

/** Client lifecycle only; authorization is always enforced on the server. */
export function isDashboardLoggingOut(): boolean {
  return loggingOut
}

export function setDashboardLoggingOut(value: boolean): void {
  loggingOut = value
}
