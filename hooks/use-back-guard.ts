"use client"

import { useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"

const parents: Record<string, string> = { addProduct: "products", products: "settings", openingHours: "settings", storeInfo: "settings", pendingOrders: "notifications", driverAssigned: "notifications", payments: "notifications" }

export function useBackGuard(activePage: string, setActivePage: (page: string) => void, popupExpanded: boolean, minimizePopup: () => void) {
  const lastBackRef = useRef(0)
  const handlingRef = useRef(false)
  const handleHardwareBack = useCallback(() => {
    if (handlingRef.current) return
    handlingRef.current = true
    if (popupExpanded) { minimizePopup(); history.pushState({ app: "merchant", page: activePage }, "", location.href); handlingRef.current = false; return }
    if (activePage === "dashboard") {
      const now = Date.now()
      if (now - lastBackRef.current < 2000) { history.back(); return }
      lastBackRef.current = now; history.pushState({ app: "merchant", page: activePage }, "", location.href); toast("Press back again to exit"); handlingRef.current = false; return
    }
    const next = parents[activePage] || "dashboard"
    setActivePage(next)
    history.pushState({ app: "merchant", page: next }, "", location.href)
    handlingRef.current = false
  }, [activePage, minimizePopup, popupExpanded, setActivePage])

  useEffect(() => {
    history.replaceState({ app: "merchant", page: "root" }, "", location.href)
    history.pushState({ app: "merchant", page: activePage }, "", location.href)
    const onPopState = () => handleHardwareBack()
    addEventListener("popstate", onPopState)
    return () => removeEventListener("popstate", onPopState)
  }, [])

  useEffect(() => { if (!handlingRef.current) history.pushState({ app: "merchant", page: activePage }, "", location.href) }, [activePage])
  return { handleHardwareBack }
}
