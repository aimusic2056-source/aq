"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { collection, query, where, onSnapshot, orderBy, Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { ALL_ORDER_STATUSES, isOrderCompleted, isRevenueOrder, isToday, isWithinPastDays } from "@/lib/order-status"
import type { FirestoreOrder } from "@/components/order-popup-panel"

interface UseRealtimeOrdersReturn {
  pendingOrders: FirestoreOrder[]
  acceptedOrders: FirestoreOrder[]
  completedOrders: FirestoreOrder[]
  allOrders: FirestoreOrder[]
  todayOrders: FirestoreOrder[]
  pastOrders: FirestoreOrder[]
  weeklyRevenueOrders: FirestoreOrder[]
  isLoading: boolean
  error: string | null
  activeOrders: FirestoreOrder[]
  pendingOrderForPopup: FirestoreOrder | null
  dismissPopup: () => void
  handleStatusUpdate: (orderId: string, newStatus: string) => void
}

const toDate = (value: unknown) => value instanceof Timestamp ? value.toDate() : value instanceof Date ? value : new Date()
const byOldest = (a: FirestoreOrder, b: FirestoreOrder) => a.createdAt.getTime() - b.createdAt.getTime()

export function useRealtimeOrders(storeId: string | null): UseRealtimeOrdersReturn {
  const [pendingOrders, setPendingOrders] = useState<FirestoreOrder[]>([])
  const [acceptedOrders, setAcceptedOrders] = useState<FirestoreOrder[]>([])
  const [completedOrders, setCompletedOrders] = useState<FirestoreOrder[]>([])
  const [allOrders, setAllOrders] = useState<FirestoreOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingOrderForPopup, setPendingOrderForPopup] = useState<FirestoreOrder | null>(null)
  const [dismissedOrderIds, setDismissedOrderIds] = useState<Set<string>>(new Set())
  const previousOrdersRef = useRef<Map<string, FirestoreOrder>>(new Map())
  const initializedRef = useRef(false)
  const orderAudioRef = useRef<HTMLAudioElement | null>(null)

  const handleStatusUpdate = useCallback((orderId: string, newStatus: string) => {
    if (newStatus === "accepted") {
      setPendingOrders((items) => items.filter((item) => item.id !== orderId))
    }
  }, [])

  useEffect(() => {
    if (!storeId) { setIsLoading(false); return }
    setIsLoading(true); setError(null); initializedRef.current = false
    const ordersQuery = query(collection(db, "orders"), where("storeId", "==", storeId), where("status", "in", [...ALL_ORDER_STATUSES]), orderBy("createdAt", "desc"))
    return onSnapshot(ordersQuery, (snapshot) => {
      const orders = snapshot.docs.map((snap) => {
        const data = snap.data()
        return { id: snap.id, orderId: data.orderId || snap.id.slice(-5).toUpperCase(), userName: data.userName || "Customer", destinationAddress: data.destinationAddress || "", items: data.items || [], subtotal: data.subtotal || 0, deliveryFee: data.deliveryFee || 0, total: data.total || 0, status: data.status, storeId: data.storeId, createdAt: toDate(data.createdAt), driverStatus: data.driverStatus, driverSnapshot: data.driverSnapshot, driver: data.driver } as FirestoreOrder
      })
      const previous = previousOrdersRef.current
      if (initializedRef.current && orders.some((order) => order.driverStatus === "at_store" && previous.get(order.id)?.driverStatus !== "at_store")) {
        const audio = new Audio("/sounds/driver.mp3"); void audio.play().catch(() => {})
      }
      previousOrdersRef.current = new Map(orders.map((order) => [order.id, order]))
      setPendingOrders(orders.filter((order) => order.status === "pending")); setAcceptedOrders(orders.filter((order) => order.status === "accepted")); setCompletedOrders(orders.filter((order) => isOrderCompleted(order.status))); setAllOrders(orders); setIsLoading(false); initializedRef.current = true
    }, (err) => { console.error("Error listening to orders:", err); setError(err.message); setIsLoading(false) })
  }, [storeId])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (pendingOrders.length) {
      const audio = orderAudioRef.current ?? new Audio("/sounds/order.mp3")
      audio.loop = true; orderAudioRef.current = audio; void audio.play().catch(() => {})
    } else if (orderAudioRef.current) { orderAudioRef.current.pause(); orderAudioRef.current.currentTime = 0 }
    return () => { if (!pendingOrders.length) orderAudioRef.current?.pause() }
  }, [pendingOrders.length])

  useEffect(() => {
    const next = pendingOrders.find((order) => !dismissedOrderIds.has(order.id))
    if (next && !pendingOrderForPopup) setPendingOrderForPopup(next)
  }, [pendingOrders, dismissedOrderIds, pendingOrderForPopup])

  const dismissPopup = useCallback(() => {
    if (pendingOrderForPopup) setDismissedOrderIds((ids) => new Set(ids).add(pendingOrderForPopup.id))
    setPendingOrderForPopup(null)
  }, [pendingOrderForPopup])
  const activeOrders = [...pendingOrders.sort(byOldest), ...acceptedOrders.sort(byOldest)]
  return { pendingOrders, acceptedOrders, completedOrders, allOrders, activeOrders, pendingOrderForPopup, dismissPopup, todayOrders: allOrders.filter((o) => isToday(o.createdAt)), pastOrders: allOrders.filter((o) => isOrderCompleted(o.status) && isWithinPastDays(o.createdAt, 90)), weeklyRevenueOrders: allOrders.filter((o) => { const week = new Date(); week.setDate(week.getDate() - 7); return o.createdAt >= week && isRevenueOrder(o.status) }), isLoading, error, handleStatusUpdate }
}

