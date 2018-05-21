const { initTracer } = require('jaeger-client')
const { FORMAT_TEXT_MAP, Tags } = require('opentracing')
const _ = require('@sailshq/lodash')

const _defaults = {

  enabled: true,
  format: FORMAT_TEXT_MAP,
  config: {
    serviceName: null,
    sampler: {
      param: 1,
      type: 'const',
      host: null
    },
    reporter: {
      logSpans: true,
      agentHost: null
    }
  },
  options:  {
    logger: {
        info: msg => {},
        error: msg => {}
    }
  }
}

class Service {

  constructor(settings) {

    this.settings = _.defaultsDeep(sails.config.jaeger || {}, _defaults)

    this.spans = []
    this.tracer = null
    this.context = null
  }

  init(url, method, headers, carrier = {}) {

    const settings = this.settings
    if (settings.enabled) {

      this.tracer = initTracer(settings.config, settings.options)
      const span = this.tracer.startSpan(method + ' ' + url, {
        childOf: this.tracer.extract(settings.format, headers),
        tags: {
          [Tags.SPAN_KIND]: Tags.SPAN_KIND_RPC_SERVER,
          [Tags.HTTP_URL]: url,
          [Tags.HTTP_METHOD]: method
        }
      })
      this.spans.push(span)
      this.tracer.inject(span.context(), settings.format, carrier)
    }

    return carrier
  }

  finish(statusCode) {

    if (this.settings.enabled) {

      const span = this._getActualSpan()
      span.setTag(Tags.HTTP_STATUS_CODE, statusCode)

      if (statusCode > 499) {
        // @todo https://github.com/opentracing/specification/issues/96
        span.setTag(Tags.ERROR, true)
        // span.log({
        //   'event': 'error',
        //   'error.kind': 'Exception',
        //   'error.object': err,
        //   'message': err.message,
        //   'stack': err.stack
        // })
      }

      this._finishSpans()
    }
  }

  startSpan(name, carrier = {}) {

    const settings = this.settings
    if (settings.enabled) {

      const span = this.tracer.startSpan(name, {
        childOf: this._getActualSpan().context(),
        tags: {
          [Tags.SPAN_KIND]: Tags.SPAN_KIND_RPC_CLIENT
        }
      })
      this.spans.push(span)
      this.tracer.inject(span.context(), settings.format, carrier)
    }
  }

  endSpan() {

    this._getActualSpan().finish()
    this.spans.pop()
  }

  _finishSpans() {

    for (let span of this.spans.reverse()) {
      span.finish()
    }
    this.spans = []
  }

  _getActualSpan() {
    return this.spans[this.spans.length - 1]
  }
}

module.exports = Service
