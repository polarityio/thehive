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
  newCase: {},
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
      this.set(`titleVerificationError`, '');
      this.set(`typeVerificationError`, '');
      this.set(`dataVerificationError`, '');
      this.set(`descriptionVerificationError`, '');

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
      this.set('errorMessage', '');

      const description = this.get('descriptionInput');
      const title = this.get('titleInput');

      if (!this.validCaseInputs(description, title)) return;
      this.set('isRunning', true);

      const severity = Number(this.get('severityInput'));
      const tlp = Number(this.get('tlpInput'));
      const pap = Number(this.get('papInput'));

      const caseInputs = {
        entity: this.get('block.entity'),
        inputs: {
          title,
          description,
          severity,
          tlp,
          pap
        }
      };

      this.sendIntegrationMessage({
        action: 'createCase',
        data: { caseInputs }
      })
        .then((caseObj) => {
          this.set('activeTab', 'cases');
          this.set('block.data', caseObj);
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
      const description = this.get('descriptionInput');
      const title = this.get('titleInput');

      if (!this.validCaseInputs(description, title)) return;
      this.set('isRunning', true);

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
          pap
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
      const observableTypeInput = this.get('observableTypeInput');
      const observableDataInput = this.get('observableDataInput');

      if (!this.validInputs(observableTypeInput, observableDataInput)) return;
      this.set('isRunning', true);

      const observableTlpInput = Number(this.get('observableTlpInput'));
      const observablePapInput = Number(this.get('observablePapInput'));
      const isIoc = this.get('isIocInput');
      const sightedInput = this.get('sightedInput');
      const observableDescriptionInput = this.get('observableDescriptionInput');
      const tagsInput = this.get('tagsInput');

      const observableInputs = {
        caseId: caseObj._id,
        inputs: {
          dataType: observableTypeInput,
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
        .then((observable) => {
          this.get(`details.${index}.caseObservables`).unshift(observable.body[0]);
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
  validInputs: function (type, data) {
    let allValid = true;

    if (!data) {
      this.set(`dataVerificationError`, 'Required');
      allValid = false;
    } else {
      this.set(`dataVerificationError`, '');
    }
    if (!type) {
      this.set(`typeVerificationError`, 'Required');
      allValid = false;
    } else {
      this.set(`typeVerificationError`, '');
    }
    return allValid;
  },
  validCaseInputs: function (description, title) {
    let allValid = true;

    if (!description) {
      this.set(`descriptionVerificationError`, 'Required');
      allValid = false;
    } else {
      this.set(`descriptionVerificationError`, '');
    }
    if (!title) {
      this.set(`titleVerificationError`, 'Required');
      allValid = false;
    } else {
      this.set(`titleVerificationError`, '');
    }

    return allValid;
  }
});
