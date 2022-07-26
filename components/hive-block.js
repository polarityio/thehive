'use strict';

polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  allowCreateCase: false,
  changeTab: 'cases',
  observableTypes: ['ip', 'hash', 'domain'],
  caseObservables: {},
  observableModal: false,
  isRunning: false,
  observableModalOpen: {},
  closeCaseModalOpen: {},
  closedCase: {},
  buttonDisabled: false,
  addObservableErrorMessage: {},
  addObservableMessage: {},
  updateCaseErrorMessage: {},
  updateCaseMessage: {},
  createCaseErrorMessage: '',
  createCaseMessage: '',
  uniqueIdPrefix: '',
  verificationError: '',
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
    createCase: function () {
      if (!this.validCaseInputs()) return;
      this.set('isRunning', true);
      this.set('errorMessage', '');

      const title = this.get('titleInput');
      const severity = Number(this.get('severityInput'));
      const description = this.get('descriptionInput');
      const tlp = Number(this.get('tlpInput'));
      const pap = Number(this.get('papInput'));

      const caseInputs = {
        entity: this.get('block.entity'),
        inputs: {
          title,
          description,
          title,
          severity,
          tlp,
          pap
        }
      };

      this.sendIntegrationMessage({
        action: 'createCase',
        data: { caseInputs }
      })
        .then(() => {
          this.set('createCaseMessage', 'Case was created!');
        })
        .catch((err) => {
          this.set('createCaseErrorMessage', JSON.stringify(`${err.meta.description.message}`));
        })
        .finally(() => {
          this.set('isRunning', false);
          setTimeout(() => {
            this.set('createCaseMessage', '');
            this.set('createCaseErrorMessage', '');
            this.get('block').notifyPropertyChange('data');
          }, 5000);
        });
    },
    updateCase: function (caseObj, index, type) {
      this.set('isRunning', true);
      this.get('block').notifyPropertyChange('data');

      const description = this.get('descriptionInput');
      const tlp = this.get('tlpInput');
      const pap = this.get('papInput');
      const severity = this.get('severityInput');
      const title = this.get('titleInput');

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
          this.set(`details.${index}.description`, description);
          this.set(`details.${index}.title`, title);
          this.set(`details.${index}.tlp`, tlp);
          this.set(`details.${index}.pap`, pap);
          this.set(`details.${index}.severity`, severity);

          this.get('block').notifyPropertyChange('data');
          this.setMessages(index, 'updateCase', 'Case was updated!');
          this.set('details.' + index + `.__${type}Open`, false);
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
        });
    },
    addObservable: function (caseObj, index, type) {
      this.set('isRunning', true);
      if (!this.validInputs()) return;

      const observableType = this.get('observableTypeInput');
      const observableDataInput = this.get('observableDataInput');
      const observableTlpInput = Number(this.get('observableTlpInput'));
      const observablePapInput = Number(this.get('observablePapInput'));
      const isIoc = this.get('isIocInput');
      const sightedInput = this.get('sightedInput');
      const observableDescriptionInput = this.get('observableDescriptionInput');
      const tagsInput = this.get('tagsInput');

      console.log('TAGGGGSSS', tagsInput);

      const observableInputs = {
        caseId: caseObj._id,
        inputs: {
          dataType: observableType,
          tlp: observableTlpInput,
          pap: observablePapInput,
          data: observableDataInput,
          ioc: isIoc,
          sighted: sightedInput,
          message: observableDescriptionInput
        }
      };

      if (tagsInput && tagsInput.length > 0) observableInputs.inputs.tags = [tagsInput];

      this.sendIntegrationMessage({
        action: 'addObservable',
        data: { observableInputs }
      })
        .then(() => {
          this.setMessages(
            index,
            'addObservable',
            `Observable ${observableDataInput} was added to case #${caseObj.number}`
          );
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

          this.set('observableTypeInput', '');
          this.set('observableDataInput', '');
          this.set('observableDescriptionInput', '');
          this.set('tagsInput', '');
          this.set('observableTlpInput', '');
          this.set('observablePapInput', '');

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
    this.set('verificationError', '');
    let allValid = true;

    ['observableTypeInput', 'observableDataInput'].forEach((el) => {
      const value = this.get(el);

      if (!value || typeof value !== 'string') {
        this.set('verificationError', 'Required');
        this.set('isRunning', false);
        allValid = false;
      } else {
        this.set('verificationError', '');
      }
    });
    return allValid;
  },
  validCaseInputs: function () {
    this.set('verificationError', '');
    let allValid = true;

    ['titleInput', 'descriptionInput'].forEach((el) => {
      const value = this.get(el);

      if (!value || typeof value !== 'string') {
        this.set('verificationError', 'Required');
        this.set('isRunning', false);
        allValid = false;
      } else {
        this.set('verificationError', '');
      }
    });

    return allValid;
  }
});
