'use strict';

polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  changeTab: 'cases',
  observableTypes: ['ip', 'hash', 'domain'],
  caseObservables: {},
  caseId: '',
  observableModal: false,
  isRunning: false,
  observableModalOpen: {},
  closeCaseModalOpen: {},
  closedCase: {},
  editedCase: {},
  buttonDisabled: false,
  verificationError: {},
  addObservableErrorMessage: {},
  addObservableMessage: {},
  updateCaseErrorMessage: {},
  updateCaseMessage: {},
  uniqueIdPrefix: '',
  cases: {},
  init () {
    this.set('changeTab', this.get('details.length') ? 'cases' : 'create');
    let array = new Uint32Array(5);
    this.set('uniqueIdPrefix', window.crypto.getRandomValues(array).join(''));

    this._super(...arguments);
  },
  actions: {
    changeTab: function (tabName) {
      this.set('changeTab', tabName);
    },
    openModal: function (caseObj, index, type) {
      this.set('titleInput', caseObj.title);
      this.set('descriptionInput', caseObj.description);
      this.toggleProperty('details.' + index + `.__${type}Open`);

      this.set(`${type}Open`, { caseObj, index });
      this.set('buttonDisabled', true);
    },
    closeModal: function (index, type) {
      this.toggleProperty('details.' + index + `.__${type}Open`);
      this.set('buttonDisabled', false);
    },
    closeCase: function (caseToClose, index) {
      this.set('isRunning', true);
      this.sendIntegrationMessage({
        action: 'closeCase',
        data: caseToClose
      })
        .then(() => {
          this.set(
            `closedCase`,
            Object.assign({}, this.get('closedCase'), {
              [caseToClose._id]: !this.get('closedCase')[caseToClose._id]
            })
          );
        })
        .catch((err) => {
          this.setErrorMessages(index, 'updateCase', `${JSON.stringify(err.meta.description.message)}`);
        })
        .finally(() => {
          this.set('isRunning', false);
          this.set('details.' + index + `.__closeCaseModalOpen`, false);
          this.set('buttonDisabled', false);
          this.get('block').notifyPropertyChange('data');
        });
    },
    updateCase: function (caseObj, index, type) {
      this.set('isRunning', true);
      const title = this.get('titleInput');
      const description = this.get('descriptionInput');
      const tlp = this.get('tlpInput');
      const pap = this.get('papInput');
      const severity = this.get('severityInput');

      const updatedInputs = {
        caseId: caseObj._id,
        inputs: {
          title,
          description,
          severity,
          tlp,
          pap,
          severity
        }
      };

      this.sendIntegrationMessage({
        action: 'updateCase',
        data: { updatedInputs }
      })
        .then(() => {
          this.setMessages(index, 'updateCase', 'Case was updated!');
        })
        .catch((err) => {
          this.setErrorMessages(index, 'updateCase', `${JSON.stringify(err.meta.description.message)}`);
        })
        .finally(() => {
          this.set('isRunning', false);
          this.set('details.' + index + `.__${type}Open`, false);
          this.set('buttonDisabled', false);
          setTimeout(() => {
            this.setErrorMessages(index, 'updateCase', '');
            this.setMessages(index, 'updateCase', '');
            this.get('block').notifyPropertyChange('data');
          }, 5000);
          a;
        });
    },
    addObservable: function (caseObj, index, type) {
      this.set('isRunning', true);
      if (!this.validInputs()) return;

      const observableDataType = this.get('observableDataType');
      const observableData = this.get('observableData');

      const observableTlpInput = Number(this.get('observableTlpInput'));
      const observablePapInput = Number(this.get('observablePapInput'));
      const isIoc = this.get('isIocInput');
      const sightedInput = this.get('sightedInput');
      const tagsInputs = this.get('tagsInputs');
      const observableDescriptionInput = this.get('observableDescriptionInput');

      const observableInputs = {
        caseId: caseObj._id,
        inputs: {
          dataType: observableDataType,
          tlp: observableTlpInput,
          pap: observablePapInput,
          data: observableData,
          ioc: isIoc,
          sighted: sightedInput,
          tags: tagsInputs,
          message: observableDescriptionInput
        }
      };

      this.sendIntegrationMessage({
        action: 'addObservable',
        data: { observableInputs }
      })
        .then(() => {
          this.setMessages(index, 'updateCase', `Observable ${observableData} was added to case #${caseObj.number}`);
        })
        .catch((err) => {
          let errMessage =
            err.meta.status === 207
              ? `${JSON.stringify(err.meta.description.failure[0].message)}`
              : `${JSON.stringify(err.meta.description.message)}`;

          this.setErrorMessages(index, 'addObservable', errMessage);
        })
        .finally(() => {
          this.set('isRunning', false);
          this.set('details.' + index + `.__${type}Open`, false);
          this.set('buttonDisabled', false);

          setTimeout(() => {
            this.setErrorMessages(index, 'addObservable', '');
            this.setMessages(index, 'addObservable', '');
            this.get('block').notifyPropertyChange('data');
          }, 5000);
        });
    },
    toggleExpandableObservables: function (index) {
      const modifiedExpandableTitleStates = Object.assign({}, this.get('caseObservables'), {
        [index]: !this.get('caseObservables')[index]
      });
      this.set(`caseObservables`, modifiedExpandableTitleStates);
    }
  },
  setErrorMessages: function (index, prefix, message) {
    if (!this.isDestroyed) {
      this.set(
        `${prefix}ErrorMessage`,
        Object.assign({}, this.get(`${prefix}ErrorMessage`), {
          [index]: message
        })
      );
    }
  },
  setMessages: function (index, prefix, message) {
    if (!this.isDestroyed) {
      this.set(`${prefix}Message`, Object.assign({}, this.get(`${prefix}Message`), { [index]: message }));
    }
  },
  validInputs: function () {
    if (!this.get('observableDataType') || !this.get('observableData')) {
      this.set('observableDataTypeInput', 'Type is required');
      this.set('observableDataInput', 'Data required');
      this.set('isRunning', false);
      return false;
    }
    return true;
  }
});
