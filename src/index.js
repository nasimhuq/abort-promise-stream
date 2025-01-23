import {observableArray} from './observableArray.js'
export function createPromiseStream() {
  const list = observableArray([])
  async function* generator() {
    while (true) {
      await waitForListToFillUp()
      list.unsubscribeAll() // no need to observe list at this time
      if (_terminated) return {done: true}
      const {promise, allOptions} = list.value.shift()
      const response = await promise
      yield {response, allOptions}
    }
  }

  const iterator = generator()
  let api = fetch
  let _terminated = false
  const terminate = () => (_terminated = true)
  const listHasValueFn = (resolve) => (unsubscribe) => () => {
    if (list.value.length > 0) {
      unsubscribe()
      resolve(true)
    }
  }
  const isTerminated = () => _terminated
  const waitForListToFillUp = async () => {
    return new Promise((resolve) => {
      if (isTerminated()) {
        list.value.forEach(({allOptions}) => {
          allOptions.config._controller.abort()
        })
        resolve(true)
        return
      }
      if (list.value.length > 0) {
        resolve(true)
        return
      }
      const listHasValue = listHasValueFn(resolve)
      const hasValue = listHasValue(() => list.unsubscribe(listHasValue))
      list.subscribe(hasValue)
    })
  }

  const STREAM_END_EVENT = 'END'
  const STREAM_DATA_EVENT = 'DATA'
  let _terminateOnError = false

  return {
    getDefaultEvents() {
      return {
        STREAM_END_EVENT: STREAM_END_EVENT,
        STREAM_DATA_EVENT: STREAM_DATA_EVENT,
      }
    },
    terminateOnError() {
      _terminateOnError = true
    },
    setApiFn(customApi) {
      api = customApi
    },
    terminate,
    isTerminated,
    addToStream(item) {
      if (isTerminated()) {
        throw new Error('Error: Cannot add item to terminated queue!')
      }
      const {url, config} = item
      const controller = new AbortController()
      const signal = controller.signal
      const allOptions = {
        config: {...config, _controller: controller},
        options: {signal},
      }
      const promise = api(url, allOptions)
        .then((data) => Promise.resolve([null, data]))
        .catch((error) => Promise.resolve([error, null]))
      list.value.push({promise, allOptions})
    },
    async start(maxIterationCount = 0) {
      let iterationCount = 0
      return new Promise(async (resolve) => {
        while (true) {
          if (isTerminated()) {
            await this.next()
            break
          }
          if (maxIterationCount > 0) {
            iterationCount++
            if (iterationCount > maxIterationCount) terminate()
          }
          await this.next()
        }
        resolve(true)
      })
    },
    async next() {
      const result = await iterator.next()
      const {allOptions, response} = result.value || {}
      if (response) {
        const {config} = allOptions
        // emit an object where fetch/promise result in response
        // and original config passed as the api param
        config?.key && this.emit(config.key, {response, config})
        this.emit(STREAM_DATA_EVENT, {response, config})
        const [error] = response
        if (_terminateOnError && error) {
          this.terminate()
        }
      }
      if (result.done) {
        this.removeAllEventListeners([STREAM_END_EVENT])
        this.emit(STREAM_END_EVENT)
      }
      return result
    },
    on(event, listener) {
      if (!this.listeners) this.listeners = {}
      if (!this.listeners[event]) this.listeners[event] = []
      this.listeners[event].push(listener)
    },
    emit(event, ...args) {
      if (this.listeners && this.listeners[event]) {
        this.listeners[event].forEach((listener) => listener(...args))
      }
    },
    removeListeners(event, listener) {
      this.listeners[event] = this.listeners[event].filter(
        (eventListener) => eventListener !== listener
      )
    },
    removeAllEventListeners(exceptEvents = []) {
      const listeners = this?.listeners
      listeners &&
        Object.keys(listeners)
          .filter((eventName) => !exceptEvents.find((exceptEvent) => eventName === exceptEvent))
          .forEach((event) => {
            while (listeners[event].length > 0) {
              console.log('listener removed', listeners[event].pop())
            }
          })
    },
  }
}

export default createPromiseStream
