export function observableArray(array) {
  const listeners = new Set()

  const proxy = new Proxy(array, {
    set: (target, property, value) => {
      const success = Reflect.set(target, property, value)
      if (success) {
        notifyListeners()
      }
      return success
    },
    get: (target, property) => {
      if (property === 'push') {
        return (...args) => {
          target.push(...args)
          notifyListeners()
          return target.length
        }
      }
      if (['pop', 'shift', 'unshift'].find((prop) => prop === property)) {
        return () => {
          const result = target[property]()
          notifyListeners()

          return result
        }
      }
      return Reflect.get(target, property)
    },
  })

  function notifyListeners() {
    listeners.forEach((listener) => {
      listener(array)
    })
  }
  function subscribe(listener) {
    listeners.add(listener)
  }
  function unsubscribeAll() {
    listeners.clear()
  }
  function unsubscribe(listener) {
    listeners.delete(listener)
  }

  return {
    value: proxy,
    subscribe,
    unsubscribe,
    unsubscribeAll,
  }
}
