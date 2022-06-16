'use strict';
const config = require('./config/config');
let fs = require('fs');
const { map } = require('lodash/fp');
let request = require('postman-request');
let _ = require('lodash');
const _configFieldIsValid = (field) => typeof field === 'string' && field.length > 0;

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

  const {
    request: { ca, cert, key, passphrase, rejectUnauthorized, proxy }
  } = config;

  const defaults = {
    ...(_configFieldIsValid(ca) && { ca: fs.readFileSync(ca) }),
    ...(_configFieldIsValid(cert) && { cert: fs.readFileSync(cert) }),
    ...(_configFieldIsValid(key) && { key: fs.readFileSync(key) }),
    ...(_configFieldIsValid(passphrase) && { passphrase }),
    ...(_configFieldIsValid(proxy) && { proxy }),
    ...(typeof rejectUnauthorized === 'boolean' && { rejectUnauthorized })
  };

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
          Logger.trace({ err }, 'Error in _requestWithDefaults');
          reject(err);
        }

        resolve(response);
      });
    });
}

const checkForStatusError = (response, requestOptions) => {
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

const doLookup = async (entities, options, cb) => {
  _setupRegexBlocklists(options);
  try {
    const lookupResults = await Promise.all(
      map(async (entity) => await getApiData(entity, requestWithDefaults, options), entities)
    );

    Logger.trace({ lookupResults }, 'lookup results');
    return cb(null, lookupResults);
  } catch (error) {
    const err = parseErrorToReadableJSON(error);
    Logger.error({ err }, 'error in doLookup');
    return cb(polarityError(err));
  }
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
    return _isEntityBlocklisted
      ? polarityResponse(entity, await getCases(entity, requestWithDefaults, options))
      : emptyResponse(entity);
  } catch (err) {
    Logger.trace({ err }, 'Error in getApiData');
    throw err;
  }
};

const getCases = async (entity, requestWithDefaults, options) => {
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
    Logger.error({ ERR: err }, 'Error in createCase');
    throw err;
  }
};

const addObservable = async (observableInputs, requestWithDefaults, options) => {
  const query = observableInputs;
  try {
    const requestOptions = await buildRequestOptions(query, ' /api/v0/case/{caseId}/artifact', options);
    const addedObservable = await requestWithDefaults(requestOptions);
    return addedObservable;
  } catch (err) {
    Logger.error({ err });
    throw err;
  }
};

const onMessage = async (payload, options, cb) => {
  switch (payload.action) {
    case 'createCase':
      const caseInputs = payload.data.caseInputs;
      // const createdCase = await createCase(caseInputs, requestWithDefaults, options);
      // check this, there is an inconsistent integration error:
      // (Notif) <injected: #64> {"title":"Integration Error Message","detail":"[Detail Not Provided]","status":"500","meta":{"message":"Unexpected end of JSON input","stack":"SyntaxError: Unexpected end of JSON input\n    at parse (<anonymous>)\n    at b (https://dev.polarity/assets/vendor-e85665e98c782a44b84f387e8c595a01.js:4157:12)\n    at g (https://dev.polarity/assets/vendor-e85665e98c782a44b84f387e8c595a01.js:4155:128)\n    at invokeWithOnError (https://dev.polarity/assets/vendor-e85665e98c782a44b84f387e8c595a01.js:3724:206)\n    at h.flush (https://dev.polarity/assets/vendor-e85665e98c782a44b84f387e8c595a01.js:3716:74)\n    at flush (https://dev.polarity/assets/vendor-e85665e98c782a44b84f387e8c595a01.js:3727:292)\n    at j._end (https://dev.polarity/assets/vendor-e85665e98c782a44b84f387e8c595a01.js:3778:9)\n    at _boundAutorunEnd (https://dev.polarity/assets/vendor-e85665e98c782a44b84f387e8c595a01.js:3736:605)"}}
      // Logger.trace({ CREATED_CASE: createdCase });
      // going to return this mock data to prevent creating cases
      cb(null, data.CREATED_CASE);
      break;
    // return cb(null, data.CREATED_CASE);
    case 'addObservable':
      const observableInputs = payload.data.observableInputs;
      const addedObservable = await addObservable(observableInputs, requestWithDefaults, options);
      cb(null, addedObservable);
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
  return {
    entity,
    data: body
      ? {
          summary: [],
          details: body
        }
      : null
  };
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

function _setupRegexBlocklists(options) {
  if (options.domainBlocklistRegex !== previousDomainRegexAsString && options.domainBlocklistRegex.length === 0) {
    Logger.debug('Removing Domain Blocklist Regex Filtering');
    previousDomainRegexAsString = '';
    domainBlocklistRegex = null;
  } else {
    if (options.domainBlocklistRegex !== previousDomainRegexAsString) {
      previousDomainRegexAsString = options.domainBlocklistRegex;
      Logger.debug({ domainBlocklistRegex: previousDomainRegexAsString }, 'Modifying Domain Blocklist Regex');
      domainBlocklistRegex = new RegExp(options.domainBlocklistRegex, 'i');
    }
  }

  if (options.ipBlocklistRegex !== previousIpRegexAsString && options.ipBlocklistRegex.length === 0) {
    Logger.debug('Removing IP Blocklist Regex Filtering');
    previousIpRegexAsString = '';
    ipBlocklistRegex = null;
  } else {
    if (options.ipBlocklistRegex !== previousIpRegexAsString) {
      previousIpRegexAsString = options.ipBlocklistRegex;
      Logger.debug({ ipBlocklistRegex: previousIpRegexAsString }, 'Modifying IP Blocklist Regex');
      ipBlocklistRegex = new RegExp(options.ipBlocklistRegex, 'i');
    }
  }
}

module.exports = {
  doLookup: doLookup,
  onMessage: onMessage,
  startup: startup,
  validateOptions: validateOptions
};

// ENTITIES TO SEARCH:
// 92.63.192.217
// 192.42.116.18

const data = {
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
    }
  }
};
