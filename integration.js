'use strict';
let fs = require('fs');
let request = require('postman-request');
let _ = require('lodash');
let config = require('./config/config');

let Logger;

let previousDomainRegexAsString = '';
let previousIpRegexAsString = '';
let domainBlocklistRegex = null;
let ipBlocklistRegex = null;
let requestWithDefaults;

/**
 *
 * @param entities
 * @param options
 * @param cb
 */

function startup(logger) {
  Logger = logger;
  let defaults = {};

  if (typeof config.request.cert === 'string' && config.request.cert.length > 0) {
    defaults.cert = fs.readFileSync(config.request.cert);
  }

  if (typeof config.request.key === 'string' && config.request.key.length > 0) {
    defaults.key = fs.readFileSync(config.request.key);
  }

  if (typeof config.request.passphrase === 'string' && config.request.passphrase.length > 0) {
    defaults.passphrase = config.request.passphrase;
  }

  if (typeof config.request.ca === 'string' && config.request.ca.length > 0) {
    defaults.ca = fs.readFileSync(config.request.ca);
  }

  if (typeof config.request.proxy === 'string' && config.request.proxy.length > 0) {
    defaults.proxy = config.request.proxy;
  }

  let _requestWithDefaults = request.defaults(defaults);

  requestWithDefaults = (requestOptions) =>
    new Promise((resolve, reject) => {
      _requestWithDefaults(requestOptions, (err, res, body) => {
        if (err) return reject(err);
        let response = { ...res, body };

        Logger.trace({ response }, 'Response in requestWithDefaults');

        try {
          checkForStatusError(response, requestOptions);
        } catch (err) {
          Logger.trace({ ERR: err });
          reject(err);
        }

        resolve(response);
      });
    });
}

const checkForStatusError = (response, requestOptions) => {
  Logger.trace({ RESPONSE: response });
  let statusCode = response.statusCode;

  if (![200, 201, 429, 500, 502, 504].includes(statusCode)) {
    const errorMessage = _.get(response, 'body.err', 'Request Error');
    const requestError = new RequestError(errorMessage, statusCode, response.body, {
      ...requestOptions,
      headers: '********'
    });
    throw requestError;
  }
};

// function _setupRegexBlocklists(options) {
//   if (options.domainBlocklistRegex !== previousDomainRegexAsString && options.domainBlocklistRegex.length === 0) {
//     Logger.debug('Removing Domain Blocklist Regex Filtering');
//     previousDomainRegexAsString = '';
//     domainBlocklistRegex = null;
//   } else {
//     if (options.domainBlocklistRegex !== previousDomainRegexAsString) {
//       previousDomainRegexAsString = options.domainBlocklistRegex;
//       Logger.debug({ domainBlocklistRegex: previousDomainRegexAsString }, 'Modifying Domain Blocklist Regex');
//       domainBlocklistRegex = new RegExp(options.domainBlocklistRegex, 'i');
//     }
//   }

//   if (options.ipBlocklistRegex !== previousIpRegexAsString && options.ipBlocklistRegex.length === 0) {
//     Logger.debug('Removing IP Blocklist Regex Filtering');
//     previousIpRegexAsString = '';
//     ipBlocklistRegex = null;
//   } else {
//     if (options.ipBlocklistRegex !== previousIpRegexAsString) {
//       previousIpRegexAsString = options.ipBlocklistRegex;
//       Logger.debug({ ipBlocklistRegex: previousIpRegexAsString }, 'Modifying IP Blocklist Regex');
//       ipBlocklistRegex = new RegExp(options.ipBlocklistRegex, 'i');
//     }
//   }
// }

const doLookup = async (entities, options, cb) => {
  let results;

  try {
    for (const ent of entities) {
      results = await getApiData(ent, requestWithDefaults, options);
      Logger.trace({ RES: results });
    }

    cb(null, results);
  } catch (error) {
    const err = parseErrorToReadableJSON(error);
    Logger.error({ err }, 'error in doLookup');
    return cb(polarityError(err));
  }

  // try {
  //   results = await Promise.all(
  //     _.map(async (entity) => await getApiData(entity, requestWithDefaults, options)),
  //     entities
  //   );

  //   return cb(null, results);
  // } catch (err) {
  //   Logger.trace({ err });
  // }
  // Logger.trace({ RESULTS: results });
  // return cb(null, results);
};

const buildRequestOptions = async (query, path, options) => {
  const data = {
    method: 'POST',
    uri: options.url + `${path}`,
    body: query,
    headers: {
      Authorization: 'Bearer ' + options.apiKey,
      'Content-Type': 'application/json'
    },
    json: true
  };
  return data;
};

const getApiData = async (entity, requestWithDefaults, options) => {
  try {
    const cases = await getCases(entity, requestWithDefaults, options);
    return polarityResponse(entity, cases);
  } catch (err) {
    Logger.trace({ err });
    throw err;
  }
};

// const createAndAddObservable = (caseId, requestWithDefaults, options) => {
//   const query = ''
//   const requestOptions = await buildRequestOptions()

// };

const getCases = async (entity, requestWithDefaults, options) => {
  // need to validate for description and  title
  const query = { query: { _string: entity.value } };
  const requestOptions = await buildRequestOptions(
    query,
    '/api/case/artifact/_search?range=all&sort=-createdAt',
    options
  );

  const response = await requestWithDefaults(requestOptions);
  Logger.trace({ response }, 'Get Cases response');
  return response;
};

const createCase = async (caseInputs, requestWithDefaults, options) => {
  try {
    const query = caseInputs;

    const requestOptions = await buildRequestOptions(query, '/api/case', options);
    const createdCase = await requestWithDefaults(requestOptions);
    Logger.trace({ createCase });

    return createdCase;
  } catch (err) {
    Logger.trace({ ERR: err });
  }
  // should return a status to the front telling USEr case was created.
};

const onMessage = async (payload, options, cb) => {
  const { caseInputs } = payload.data;

  switch (payload.action) {
    case 'createCase':
      try {
        // const createdCase = await createCase(caseInputs, requestWithDefaults, options);
        // check this, there is an inconsistent integration error:
        // (Notif) <injected: #64> {"title":"Integration Error Message","detail":"[Detail Not Provided]","status":"500","meta":{"message":"Unexpected end of JSON input","stack":"SyntaxError: Unexpected end of JSON input\n    at parse (<anonymous>)\n    at b (https://dev.polarity/assets/vendor-e85665e98c782a44b84f387e8c595a01.js:4157:12)\n    at g (https://dev.polarity/assets/vendor-e85665e98c782a44b84f387e8c595a01.js:4155:128)\n    at invokeWithOnError (https://dev.polarity/assets/vendor-e85665e98c782a44b84f387e8c595a01.js:3724:206)\n    at h.flush (https://dev.polarity/assets/vendor-e85665e98c782a44b84f387e8c595a01.js:3716:74)\n    at flush (https://dev.polarity/assets/vendor-e85665e98c782a44b84f387e8c595a01.js:3727:292)\n    at j._end (https://dev.polarity/assets/vendor-e85665e98c782a44b84f387e8c595a01.js:3778:9)\n    at _boundAutorunEnd (https://dev.polarity/assets/vendor-e85665e98c782a44b84f387e8c595a01.js:3736:605)"}}
        // Logger.trace({ CREATED_CASE: createdCase });
        // going to return this mock data to prevent creating cases
        return cb(null, data.CREATED_CASE);
        // return cb(null, data.CREATED_CASE);
      } catch (err) {
        Logger.trace({ ERR: err });
      }
      break;
    default:
      return;
  }
};
/**
 * These functions return potential response objects the integration can return to the client
 */
const polarityError = (err) => ({
  detail: err.message || 'Unknown Error',
  error: err
});

const emptyResponse = (entity) => ({
  entity,
  data: null
});

const polarityResponse = (entity, { body }) => {
  return [
    {
      entity,
      data: body
        ? {
            summary: [],
            details: body
          }
        : null
    }
  ];
};

const retryablePolarityResponse = (entity) => {
  return {
    entity,
    isVolatile: true,
    data: {
      summary: ['Lookup limit reached'],
      details: {
        summaryTag: 'Lookup limit reached',
        errorMessage:
          'A temporary TheHive API search limit was reached. You can retry your search by pressing the "Retry Search" button.'
      }
    }
  };
};

class RequestError extends Error {
  constructor(message, status, description, requestOptions) {
    super(message);
    this.name = 'requestError';
    this.status = status;
    this.description = description;
    this.requestOptions = requestOptions;
  }
}

const parseErrorToReadableJSON = (err) => {
  return err instanceof Error
    ? {
        ...err,
        name: err.name,
        message: err.message,
        stack: err.stack,
        detail: err.message ? err.message : 'Unexpected error encountered'
      }
    : err;
};

function _isEntityBlocklisted(entity, options) {
  const blocklist = options.blocklist;

  Logger.trace({ blocklist: blocklist }, 'checking to see what blocklist looks like');

  if (_.includes(blocklist, entity.value.toLowerCase())) {
    return true;
  }

  if (entity.isIP && !entity.isPrivateIP) {
    if (ipBlocklistRegex !== null) {
      if (ipBlocklistRegex.test(entity.value)) {
        Logger.debug({ ip: entity.value }, 'Blocked BlockListed IP Lookup');
        return true;
      }
    }
  }

  if (entity.isDomain) {
    if (domainBlocklistRegex !== null) {
      if (domainBlocklistRegex.test(entity.value)) {
        Logger.debug({ domain: entity.value }, 'Blocked BlockListed Domain Lookup');
        return true;
      }
    }
  }

  return false;
}

function validateOptions(userOptions, cb) {
  let errors = [];
  if (
    typeof userOptions.apiKey.value !== 'string' ||
    (typeof userOptions.apiKey.value === 'string' && userOptions.apiKey.value.length === 0)
  ) {
    errors.push({
      key: 'apiKey',
      message: 'You must provide a valid API key'
    });
  }
  cb(null, errors);
}

module.exports = {
  doLookup: doLookup,
  onMessage: onMessage,
  startup: startup,
  validateOptions: validateOptions
};

// Given a user wants to change the status of the tickets:
// - Update different fields such as description
// - Close out the cases if needed.

// Users creating cases around indicators:
// - Users should also be able to create a case if one does not exist for an indicator - POST /api/case
// ** IF THE INDICATOR DOES NOT EXIST:
// ** A user searches using an indicator -> The Api responds with a status of 200 and an empty body ->
// ** The UI should render "create" option, and the user should be able to create a case for the missed indicator
// **
// ** IF THE INDICATOR DOES EXIST:
// ** Then the

// - Users should be able to create a new case on an existing indicator.

// ENTITIES:
// 92.63.192.217

// Should users  be able to create a Case, and add IOC observable to the case? - POST	/api/case/:caseId/artifact	Create an observable

// function doLookup(entities, options, cb) {
//   let lookupResults = [];
//   let tasks = [];

//   _setupRegexBlocklists(options);

//   Logger.trace({ entities: entities }, 'Loging the entity coming through');

//   entities.forEach((entity) => {
//     if (_isEntityBlocklisted(entity, options)) {
//       next(null);
//     } else if (entity.value) {
//       //do the lookup
//       let postData = { query: { _string: entity.value } };
//       let requestOptions = {
//         method: 'POST',
//         uri: options.url + '/api/case/artifact/_search?range=all&sort=-createdAt',
//         body: postData,
//         headers: {
//           Authorization: 'Bearer ' + options.apiKey,
//           'Content-Type': 'application/json'
//         },
//         json: true
//       };

//       Logger.trace({ uri: options }, 'Request URI');

//       tasks.push(function (done) {
//         requestWithDefaults(requestOptions, function (err, res, body) {
//           if (err) {
//             Logger.error({ err: err }, 'Error Executing Request');
//             done(err);
//             return;
//           }

//           Logger.trace({ body: body, statusCode: res.statusCode }, 'Result of Lookup');

//           let result = {};

//           if (res.statusCode === 200) {
//             // we got data!
//             result = {
//               entity: entity,
//               body: body
//             };
//           } else if (res.statusCode === 404) {
//             // no result found
//             result = {
//               entity: entity,
//               body: null
//             };
//           } else if (res.statusCode === 202) {
//             // no result found
//             result = {
//               entity: entity,
//               body: null
//             };
//           }
//           if (body.error) {
//             // entity not found
//             result = {
//               entity: entity,
//               body: null
//             };
//           }
//           done(null, result);
//         });
//       });
//     }
//   });

//   async.parallelLimit(tasks, MAX_PARALLEL_LOOKUPS, (err, results) => {
//     if (err) {
//       cb(err);
//       return;
//     }

//     results.forEach((result) => {
//       if (result.body === null || (Array.isArray(result.body) && result.body.length === 0)) {
//         lookupResults.push({
//           entity: result.entity,
//           data: null
//         });
//       } else {
//         lookupResults.push({
//           entity: result.entity,
//           data: {
//             summary: [],
//             details: result.body
//           }
//         });
//       }
//     });

//     cb(null, lookupResults);
//   });
// }

const data = {
  name: 'TheHive',
  hostname: 'dev.polarity',
  pid: 14487,
  level: 10,
  CREATED_CASE: {
    statusCode: 201,
    body: {
      owner: 'admin',
      severity: 2,
      _routing: 'AYFFEH2X9IjF18k1tr8f',
      flag: false,
      customFields: {},
      _type: 'case',
      description: 'asdasdasdasd',
      title: 'asdasd',
      createdAt: 1654721117305,
      _parent: null,
      createdBy: 'admin',
      caseId: 24,
      tlp: 1,
      metrics: {},
      _id: 'AYFFEH2X9IjF18k1tr8f',
      id: 'AYFFEH2X9IjF18k1tr8f',
      _version: 1,
      pap: 2,
      startDate: 1654721117591,
      status: 'Open'
    },
    headers: {
      date: 'Wed, 08 Jun 2022 20:45:18 GMT',
      connection: 'close',
      'content-type': 'application/json',
      'content-length': '370'
    },
    request: {
      uri: {
        protocol: 'http:',
        slashes: true,
        auth: null,
        host: '54.226.8.208:9000',
        port: '9000',
        hostname: '54.226.8.208',
        hash: null,
        search: null,
        query: null,
        pathname: '/api/case',
        path: '/api/case',
        href: 'http://54.226.8.208:9000/api/case'
      },
      method: 'POST',
      headers: {
        Authorization: 'Bearer IWPcPkikfFlpkn8jiFD7x3s6OmfV2Wpi',
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Content-Length': 71
      }
    }
  },
  msg: '',
  time: '2022-06-08T20:45:18.760Z',
  v: 0
};
