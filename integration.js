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
          Logger.trace({ requestOptions });
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

  if (![200, 201, 204, 400, 429, 500, 502, 504].includes(statusCode)) {
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
    Logger.error({ err });
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
    if (_isEntityBlocklisted(entity, options)) return;
    const cases = await getCases(entity, requestWithDefaults, options);
    Logger.trace({ cases }, 'cases');
    return polarityResponse(entity, options, cases);
  } catch (err) {
    Logger.trace({ err });
    throw err;
  }
};

const getCases = async (entity, requestWithDefaults, options) => {
  try {
    if (entity.isHash) entity.value.toLowerCase();

    const getCasesQuery = {
      query: [
        { _name: 'listObservable' },
        { _name: 'filter', _eq: { _field: 'data', _value: entity.value } },
        { _name: 'case' }
      ]
    };
    const getCasesOptions = await buildRequestOptions(getCasesQuery, 'POST', '/api/v1/query', options);
    const cases = await requestWithDefaults(getCasesOptions);

    const casesWithObservables = await Promise.all(
      map(async (currentCase) => await getObservablesForCase(currentCase, requestWithDefaults, options), cases.body)
    );

    return casesWithObservables;
  } catch (err) {
    Logger.error({ err });
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
    const caseObservables = _.orderBy(observablesForCase.body, '_createdAt', 'desc');
    const casesWithObservables = Object.assign({}, currentCase, { caseObservables });

    return casesWithObservables;
  } catch (err) {
    Logger.error({ err });
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

const createCase = async (caseInputs, entity, requestWithDefaults, options) => {
  try {
    const query = caseInputs;
    const requestOptions = await buildRequestOptions(query, 'POST', '/api/v1/case', options);
    const createdCase = await requestWithDefaults(requestOptions);

    const defaultObservableInputs = {
      caseId: createdCase.body._id,
      inputs: { data: entity.value, dataType: getDataType(entity) }
    };

    if (createdCase.statusCode === 201) {
      await addObservable(defaultObservableInputs, requestWithDefaults, options);
    }

    return createdCase;
  } catch (err) {
    Logger.error({ ERR: err });
    throw err;
  }
};

const getDataType = (entity) => {
  if (entity.isDomain) return 'domain';
  if (entity.isHash) return 'hash';
  if (entity.isIP) return 'ip';
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
      try {
        const caseInputs = payload.data.caseInputs.inputs;
        const entity = payload.data.caseInputs.entity;
        await createCase(caseInputs, entity, requestWithDefaults, options);
        const caseObj = await getApiData(entity, requestWithDefaults, options);

        cb(null, caseObj.data);
      } catch (err) {
        Logger.error({ err });
        cb(err, {});
      }
      break;
    case 'addObservable':
      try {
        const observableInputs = payload.data.observableInputs;
        const addedObservable = await addObservable(observableInputs, requestWithDefaults, options);
        cb(null, addedObservable);
      } catch (err) {
        Logger.error({ err });
        cb(err, {});
      }
      break;
    case 'updateCase':
      try {
        const updatedInputs = payload.data.updatedInputs;
        const updatedCase = await updateCase(updatedInputs, requestWithDefaults, options);
        cb(null, updatedCase);
      } catch (err) {
        Logger.error({ err });
        cb(err, {});
      }
      break;
    case 'closeCase':
      try {
        const caseToClose = payload.data._id;
        const closedCase = await closeCase(caseToClose, requestWithDefaults, options);
        cb(null, closedCase);
      } catch (err) {
        Logger.error({ err });
        cb(err, {});
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

const polarityResponse = (entity, options, cases) => {
  if (options.allowCreateCase && !cases.length)
    return { entity, data: { summary: ['No Cases Found', 'Create Case'], details: { allowCreateCase: true } } };
  else return { entity, data: cases.length > 0 ? { summary: getSummary(cases), details: cases } : null };
};

const getSummary = (cases) => {
  const tags = [];
  if (cases.length) tags.push(`Cases: ${cases.length}`);
  return tags;
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
  if (
    typeof userOptions.url.value !== 'string' ||
    (typeof userOptions.url.value === 'string' && userOptions.url.value.length === 0)
  ) {
    errors.push({
      key: 'apiKey',
      message: 'You must provide a URL'
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
