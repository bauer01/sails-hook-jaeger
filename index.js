const _ = require('@sailshq/lodash')
const Service = require('./lib/service')

module.exports = function jaeger(sails) {

  const _defaults = {

    config: {
      serviceName: sails.config.appName || null,
    },
    options:  {
      logger: {
          info: (msg) => {
              sails.log.info('Jaeger:', msg)
          },
          error: (msg) => {
              sails.log.error('Jaeger:', msg)
          }
      }
    }
  }

  const settings = _.defaultsDeep(sails.config.jaeger || {}, _defaults)
  const service = new Service(settings)

  return {

    configure: () => {

      if (settings.enabled) {

        const middleware = sails.config.http.middleware
        middleware.jaeger = (req, res, next) => {

          service.init(req.url, req.method, req.headers)
          res.on('finish', () => {
            service.finish(res.statusCode)
          })
          next()
        }
        middleware.order.unshift('jaeger')
      }
    },
    service
  }
}
