'use strict';

polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  changeTab: 'cases',
  levels: { white: '#5bc0de', green: '#5cb85c', amber: '#f0ad4e', red: '#d9534f' },
  severityLevels: { L: '#5cb85c', M: '#5bc0de', H: '#f0ad4e', '!!': '#d9534f' },
  observableTypes: ['ip', 'hash', 'domain'],
  caseObservables: {},
  currentSeverityElement: '',
  currentTlpElement: '',
  currentPapElement: '',
  currentObservableTlpElement: '',
  caseId: '',
  observableModal: false,
  editModalOpen: false,
  isRunning: false,
  editModalOpen: {},
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
      this.set('descriptionInput', caseObj.description)
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
      const severity = Number(this.get('severityInput'));
      const description = this.get('updatedDescriptionInput');
      const tlp = Number(this.get('tlpInput'));
      const pap = Number(this.get('papInput'));

      const updatedInputs = {
        caseId: caseObj._id,
        inputs: {
          title,
          description,
          tlp,
          pap: pap,
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
      const isIoc = this.get('isIocInput');
      const sightedInput = this.get('sightedInput');
      const tagsInputs = this.get('tagsInputs');
      const observableDescriptionInput = this.get('observableDescriptionInput');

      const observableInputs = {
        caseId: caseObj._id,
        inputs: {
          dataType: observableDataType,
          tlp: observableTlpInput,
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
          this.setErrorMessages(index, 'addObservable', `${JSON.stringify(err.meta.description.message)}`);
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
    },
    selectLevelAndSetInput: function (level, colorValue, type) {
      console.log(level, colorValue);
      const LEVELS = {
        white: '0',
        green: '1',
        amber: '2',
        red: '3'
      };

      let currentElement;

      if (type === 'observable-tlp') {
        this.set('observableTlpInput', level.toUpperCase());
        currentElement = 'currentObservableTlpElement';
      } else {
        this.set(`${type === 'tlp' ? 'tlpInput' : 'papInput'}`, LEVELS[level]);
        currentElement = type === 'tlp' ? 'currentTlpElement' : 'currentPapElement';
      }

      if (colorValue !== this.get(currentElement)) {
        const cachedElementValue = this.get(currentElement);
        let cachedElement = document.getElementById(`${type}-${cachedElementValue}`);

        if (cachedElement) {
          cachedElement.style['background-color'] = '#d2d6de';
        }

        this.set(currentElement, colorValue);
        let element = document.getElementById(`${type}-${colorValue}`);
        if (element) {
          element.style['background-color'] = colorValue;
        }
      }
      this.set(currentElement, colorValue);
    },
    selectSeverityLevelAndSetInput: function (level, colorValue) {
      console.log(level, colorValue);
      const SEVERITY_LEVELS = { L: 1, M: 2, H: 3, '!!': 4 };
      this.set('severityInput', SEVERITY_LEVELS[level]);

      if (colorValue !== this.get('currentSeverityElement')) {
        const cachedElementValue = this.get('currentSeverityElement');

        let cachedElement = document.getElementById(`severity-${cachedElementValue}`);
        if (cachedElement) {
          cachedElement.style['background-color'] = '#d2d6de';
        }

        let element = document.getElementById(`severity-${colorValue}`);
        if (element) {
          element.style['background-color'] = `${colorValue}`;
        }
      }
      this.set('currentSeverityElement', colorValue);
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
