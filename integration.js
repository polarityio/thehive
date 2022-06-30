'use strict';

const config = require('./config/config');
const { map } = require('lodash/fp');
const fs = require('fs');
const request = require('postman-request');
const _ = require('lodash');
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

function startup (logger) {
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

  if (![200, 201, 204, 429, 500, 502, 504].includes(statusCode)) {
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

const buildRequestOptions = async (query, restVerb, path, options) => {
  const requestOptions = {
    method: restVerb,
    uri: options.url + `${path}`,
    body: query,
    headers: {
      Authorization: 'Bearer ' + options.apiKey,
      'Content-Type': 'application/json'
    },
    json: true
  };
  return requestOptions;
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
  try {
    if (entity.isHash) entity.value.toLowerCase();
    const getCasesQuery = {
      query: [
        { _name: 'listObservable' },
        { _name: 'filter', _eq: { _field: 'data', _value: entity.value.toLowerCase() } },
        { _name: 'case' }
      ]
    };
    const getCasesOptions = await buildRequestOptions(getCasesQuery, 'POST', '/api/v1/query', options);
    const cases = await requestWithDefaults(getCasesOptions);

    const response = await Promise.all(
      map(async (currentCase) => await getObservablesForCase(currentCase, requestWithDefaults, options), cases.body)
    );

    return response;
  } catch (err) {
    Logger.error({ err }, 'Error in getCases');
    throw err;
  }
};

const getObservablesForCase = async (currentCase, requestWithDefaults, options) => {
  try {
    const getObservablesForCaseQuery = {
      query: [{ _name: 'getCase', idOrName: currentCase._id }, { _name: 'observables' }]
    };

    const getObservableForCaseOptions = await buildRequestOptions(
      getObservablesForCaseQuery,
      'POST',
      '/api/v1/query',
      options
    );
    const observablesForCase = await requestWithDefaults(getObservableForCaseOptions);
    currentCase.caseObservables = observablesForCase.body;

    return currentCase;
  } catch (err) {
    Logger.error({ err }, 'Error in getObservablesForCase');
    throw err;
  }
};

const createCase = async (caseInputs, requestWithDefaults, options) => {
  try {
    const query = caseInputs;

    const requestOptions = await buildRequestOptions(query, 'POST', '/api/v1/case', options);
    const createdCase = await requestWithDefaults(requestOptions);

    return createdCase;
  } catch (err) {
    Logger.error({ err }, 'Error in createCase');
    throw err;
  }
};

const updateCase = async (updatedInputs, requestWithDefaults, options) => {
  try {
    const query = updatedInputs.inputs;
    const caseId = updatedInputs.caseId;

    const requestOptions = await buildRequestOptions(query, 'PATCH', `/api/v1/case/${caseId}`, options);
    const updatedCase = await requestWithDefaults(requestOptions);

    return updatedCase;
  } catch (err) {
    Logger.error({ err });
    throw err;
  }
};

const closeCase = async (caseToClose, requestWithDefaults, options) => {
  try {
    const requestOptions = await buildRequestOptions({}, 'DELETE', `/api/v1/case/${caseToClose}`, options);
    const closedCase = await requestWithDefaults(requestOptions);

    return closedCase;
  } catch (err) {
    Logger.error({ err });
    throw err;
  }
};

const addObservable = async (observableInputs, requestWithDefaults, options) => {
  const query = observableInputs.inputs;
  const caseId = observableInputs.caseId;

  try {
    const requestOptions = await buildRequestOptions(query, 'POST', `/api/v1/case/${caseId}/observable`, options);
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
      const createdCase = await createCase(caseInputs, requestWithDefaults, options);
      const response = _.get(createdCase, 'body', {});
      cb(null, response);
      break;
    case 'addObservable':
      const observableInputs = payload.data.observableInputs;
      const addedObservable = await addObservable(observableInputs, requestWithDefaults, options);
      cb(null, addedObservable);
      break;
    case 'updateCase':
      const updatedInputs = payload.data.updatedInputs;

      const updatedCase = await updateCase(updatedInputs, requestWithDefaults, options);
      cb(null, updatedCase);
      break;
    case 'closeCase':
      const caseToClose = payload.data._id;
      const closedCase = await closeCase(caseToClose, requestWithDefaults, options);
      cb(null, closedCase);
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

const polarityResponse = (entity, response) => {
  return {
    entity,
    data:
      response.length > 0
        ? {
            summary: [],
            details: response
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
  constructor (message, status, description, requestOptions) {
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

function _isEntityBlocklisted (entity, options) {
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

function validateOptions (userOptions, cb) {
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

function _setupRegexBlocklists (options) {
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
