import { paramsToQueryString, getUrlQueryParams, getURLJWT } from './../message/util.js'
import { randomString } from '../crypto.js'
import { decodeJWT } from 'did-jwt'
import nets from 'nets'
const CHASQUI_URL = 'https://chasqui.uport.me/api/v1/topic/'
const POLLING_INTERVAL = 2000

// TODO can the name of URIHandler be changed
// TODO should it just allow cancel func to be passed in??
// TODO Should it return uri append to promise? instead of a promise??
/**
  *  A general Chasqui Transport. Allows you to configure the transport with any uriHandler for the request,
  *  while the response will always be returned through Chasqui. Chasqui is a simple messaging server that
  *  allows responses to be relayed from a uport client to the original callee.
  *
  *  @param    {String}       uriHandler              a function called with the requestURI once it is formatted for this transport
  *  @param    {Object}       [config={}]             an optional config object
  *  @param    {String}       config.chasquiUrl       url of messaging server, defaults to Chasqui instance run by uPort
  *  @param    {String}       config.pollingInterval  milisecond interval at which the messaging server will be polled for a response
  *  @return   {Function}                             a configured QRTransport Function
  *  @param    {String}       uri                     a uport client request URI
  *  @return   {Promise<Object, Error>}               a function to close the QR modal
  */
const URIHandlerSend = (uriHandler, {chasquiUrl = CHASQUI_URL, pollingInterval = POLLING_INTERVAL} = {}) => {
  if (!uriHandler) throw new Error('uriHandler function required')
  return (uri) => {
    const callback = getCallback(uri)
    let isCancelled = false
    const cancel = () => { isCancelled = true }
    uri = paramsToQueryString(uri, {'type': 'post'})
    uriHandler(uri, { cancel })
    const returnVal = poll(callback, pollingInterval, () => isCancelled)
    returnVal.cancel = cancel
    return returnVal
  }
}

/**
  *  A polling function specifically for polling Chasqui.
  *
  *  @param    {String}                  url                a Chasqui url polled
  *  @param    {Integer}                 pollingInterval    ms interval at which the given url is polled
  *  @param    {Function}                cancelled          function which returns boolean, if returns true, polling stops
  *  @return   {Promise<Object, Error>}                     a promise which resolves with obj/message or rejects with an error
  */
const poll = (url, pollingInterval, cancelled ) => {
  const messageParse = (res) => { if (res.message) return res.message['access_token'] || res.message['tx'] }
  const errorParse = (res) => { if (res.message) return res.message.error }
  return generalPoll(url, messageParse, errorParse, cancelled, pollingInterval).then(res => {
    clearResponse(url)
    return res
  })
}

// TODO maybe remove and just have reasonable removal times
const clearResponse = (url) => {
  nets({
    uri: url,
    method: 'DELETE',
    withCredentials: false,
    rejectUnauthorized: false
  }, function (err) { if (err) { throw err } /* Errors without this cb */ })
}

const genCallback = () => `${CHASQUI_URL}${randomString(16)}`
const isChasquiCallback = (uri) => new RegExp(CHASQUI_URL).test(getCallback(uri))
const getCallback = (uri) => decodeJWT(getURLJWT(uri)).payload.callback

export { URIHandlerSend,
         poll,
         clearResponse,
         genCallback,
         isChasquiCallback }
