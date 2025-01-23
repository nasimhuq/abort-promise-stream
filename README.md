# abort-promise-stream
**stream of promises. All promises are executed concurrently and all promise responses are emitted in the order each was entered. User can abort/terminate the stream on any response.**

Stream emits an object `{response, config}` where response is `[error, data]` for `DATA` event
  * On successful `response` object contains `data`, which will contain the response body.
  * On error `response` object contains `error`, which will contain the error message.


# Install

`npm install --save @nasimhuq/abort-promise-stream`

# Typical usage

Require as **CJS**

```js
const CreatePromiseStream = require('@nasimhuq/abort-promise-stream');
```

Import as **ES6 Module**
```js
import CreatePromiseStream from '@nasimhuq/abort-promise-stream';
```

# Examples

Example 1: Single batch of requests

```js
import CreatePromiseStream from '@nasimhuq/abort-promise-stream'

const getResolvePromise = (_url, item, ms) => {
  return new Promise((resolve) => {
    setTimeout(() => resolve({...item, responseCode: 'SUCCESS'}), ms)
  })
}

const getRejectPromise = (_url, item, ms) => {
  return new Promise((_resolve, reject) => {
    setTimeout(() => reject({...item, responseCode: 'FAILURE'}), ms)
  })
}

const logOut = ({url, allOptions, ms}) => {
  const logInfo = {
    url,
    'expected time cost': ms,
    reject: !!allOptions.config.reject,
    key: allOptions.config.key,
  }
  console.table(logInfo)
}
const logResponse = ([error, data]) => {
  const end = Date.now()
  const {
    config: {key, _started},
    responseCode,
    url,
    ms,
  } = error ? error : data

  console.table({
    respond: responseCode,
    url,
    key,
    'expected time cost': ms,
    duration: end - _started,
  })
}

const customApi = (url, allOptions) => {
  const ms = Math.ceil(Math.random() * 10000)
  const started = Date.now()

  logOut({
    url,
    allOptions,
    ms,
  })
  const _allOptions = {
    ...allOptions,
    config: {...allOptions.config, _started: started},
    url,
    ms,
  }
  const getPromise = allOptions.config.reject ? getRejectPromise : getResolvePromise
  return getPromise(url, _allOptions, ms)
}

const batchOne = [
  {url: 'First.com', config: {key: crypto.randomUUID()}},
  {url: 'Second.com', config: {key: crypto.randomUUID()}},
  {url: 'Third.com', config: {key: crypto.randomUUID(), reject: true}},
  {url: 'Forth.com', config: {key: crypto.randomUUID()}},
]
const batchTwo = [
  {url: 'Fifth.com', config: {key: crypto.randomUUID(), reject: true}},
  {url: 'Sixth.com', config: {key: crypto.randomUUID()}},
  {url: 'Seventh.com', config: {key: crypto.randomUUID()}},
]

const addPromiseToStream = (stream) => (batchOne, batchTwo) => {
  batchOne.forEach((item) => {
    if (stream.isTerminated()) return
    stream.addToStream(item)
    stream.on(item.config.key, ({response, config}) => {
      logResponse(response)
    })
  })

  setTimeout(() => {
    batchTwo.forEach((item) => {
      if (stream.isTerminated()) return
      stream.addToStream(item)
      stream.on(item.config.key, ({response, config}) => {
        logResponse(response)
      })
    })
  }, 9000)
}

async function multipleBatches() {
  const stream = CreatePromiseStream()
  const defaultEvents = stream.getDefaultEvents()
  stream.setApiFn(customApi)
  stream.on(defaultEvents.STREAM_END_EVENT, () => {
    stream.removeAllEventListeners()
    console.log('Stream One ended')
  })
  addPromiseToStream(stream)(batchOne, batchTwo)
  const TotalApiCount = batchOne.length + batchTwo.length
  return await stream.start(TotalApiCount)
}

async function multipleBatchesAbortOnFirstError() {
  const stream = CreatePromiseStream()
  const defaultEvents = stream.getDefaultEvents()
  stream.setApiFn(customApi)
  stream.terminateOnError()
  stream.on(defaultEvents.STREAM_END_EVENT, () => {
    stream.removeAllEventListeners()
    console.log('Stream Two ended')
  })
  addPromiseToStream(stream)(batchOne, batchTwo)
  const TotalApiCount = batchOne.length + batchTwo.length
  return await stream.start(TotalApiCount)
}

async function tests() {
  await multipleBatches()
  await multipleBatchesAbortOnFirstError()
}

tests()

```

# abort-promise-stream can be used in node.js

