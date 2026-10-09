export type CallPhase = "customer" | "driver"

export interface CallRuleOrder {
  id: string
  orderId?: string
  status?: string
  driverStatus?: string
  userName?: string
  driverSnapshot?: { firstName?: string } | null
}

export interface CallOption {
  orderDocId: string
  shortId: string
  phase: CallPhase
  peerName: string
  label: string
}

const CUSTOMER_STATUSES = ["pending", "accepted", "ready_for_pickup"]
const CUSTOMER_DRIVER_STATUSES = ["waiting", "no_driver_found", ""]
const DRIVER_STATUSES = ["driver_assigned", "at_store"]
const DRIVER_DRIVER_STATUSES = ["assigned", "at_store"]

export function getCallOption(order: CallRuleOrder, storeCategory: string): CallOption | null {
  const status = order.status ?? ""
  const driverStatus = order.driverStatus ?? ""
  const shortId = order.orderId || order.id.slice(-5).toUpperCase()

  if (storeCategory === "market" && CUSTOMER_STATUSES.includes(status) && CUSTOMER_DRIVER_STATUSES.includes(driverStatus)) {
    return { orderDocId: order.id, shortId, phase: "customer", peerName: order.userName || "Customer", label: "Call customer" }
  }
  if (DRIVER_STATUSES.includes(status) && DRIVER_DRIVER_STATUSES.includes(driverStatus)) {
    return { orderDocId: order.id, shortId, phase: "driver", peerName: order.driverSnapshot?.firstName || "Driver", label: "Call driver" }
  }
  return null
}

export function getCallOptions(orders: CallRuleOrder[], storeCategory: string): CallOption[] {
  const options: CallOption[] = []
  for (const order of orders) {
    const option = getCallOption(order, storeCategory)
    if (option) options.push(option)
  }
  return options
}
