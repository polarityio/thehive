'use strict';

polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  changeTab: 'cases',
  levels: { white: '#5bc0de', green: '#5cb85c', amber: '#f0ad4e', red: '#d9534f' },
  severityLevels: { L: '#5cb85c', M: '#5bc0de', H: '#f0ad4e', '!!': '#d9534f' },
  observableTypes: ['ip', 'hash', 'domain'],
  currentSeverityElement: '',
  currentTlpElement: '',
  currentPapElement: '',
  currentObservableTlpElement: '',
  caseId: '',
  addObservableIsDisabled: false,
  observableModal: false,
  editModalOpen: false,
  caseCreated: false,
  isRunning: false,
  editModalOpen: {},
  observableModalOpen: {},
  closeCaseModalOpen: {},
  closedCase: {},
  cases: {},
  init () {
    this.set('changeTab', this.get('details.length') ? 'cases' : 'create');
    this._super(...arguments);
  },
  actions: {
    changeTab: function (tabName) {
      this.set('changeTab', tabName);
    },
    toggleModal: function (caseObj, index, type) {
      console.log(JSON.stringify(type));
      this.toggleProperty('details.' + index + `.__${type}Open`);
      this.set(`${type}Open`, { caseObj, index });
    },
    addObservableToCreatedCase: function () {
      this.toggleProperty('observableModal');
    },
    submit: function () {
      this.set('isRunning', true);
      this.set('errorMessage', '');
      const title = this.get('titleInput');
      const severity = Number(this.get('severityInput'));
      const description = this.get('descriptionInput');
      const tlp = Number(this.get('tlpInput'));
      const pap = Number(this.get('papInput'));

      const caseInputs = {
        title,
        description,
        title,
        severity,
        tlp,
        pap
      };

      this.sendIntegrationMessage({
        action: 'createCase',
        data: { caseInputs }
      })
        .then((data) => {
          this.set('addObservableIsDisabled', false);
          this.set('caseCreated', true);
          this.set('caseId', data._id);
        })
        .catch((err) => {
          this.set('details.errorMessage', JSON.stringify(err, null, 4));
        })
        .finally(() => {
          this.set('isRunning', false);
          this.get('block').notifyPropertyChange('data');
        });
    },
    closeCase: function (caseToClose, index, type = 'closeCaseModal') {
      this.set('isRunning', true);
      this.sendIntegrationMessage({
        action: 'closeCase',
        data: caseToClose
      })
        .then((data) => {
          console.log(JSON.stringify(data));
        })
        .catch((err) => {
          console.log(JSON.stringify(err));
        })
        .finally(() => {
          this.set('isRunning', false);
          this.set('details.' + index + `.__${type}Open`, false);
          // this.set('details.' + index + `.__closedCase`, true);
          this.get('block').notifyPropertyChange('data');
        });
    },
    submitEdit: function (caseObj, index, type) {
      this.set('isRunning', true);
      const title = this.get('updatedTitleInput');
      const severity = Number(this.get('severityInput'));
      const description = this.get('updatedDescriptionInput');
      const tlp = Number(this.get('tlpInput'));
      const pap = Number(this.get('papInput'));

      const updatedInputs = {
        caseId: caseObj._id,
        inputs: {
          title,
          description,
          tlp: tlp,
          pap: pap,
          severity
        }
      };

      this.sendIntegrationMessage({
        action: 'updateCase',
        data: { updatedInputs }
      })
        .then((data) => {
          console.log(JSON.stringify(data));
        })
        .catch((err) => {
          console.log(err);
          this.set('details.errorMessage', JSON.stringify(err, null, 4));
        })
        .finally(() => {
          this.set('isRunning', false);
          this.set('details.' + index + `.__${type}Open`, false);
          this.get('block').notifyPropertyChange('data');
        });
    },
    addObservable: function (caseObj) {
      this.set('isRunning', true);
      const typeInput = this.get('observableTypeInput');
      const observableTlpInput = Number(this.get('observableTlpInput'));
      const valueInput = this.get('valueInput');
      const isIoc = this.get('isIocInput');
      const sightedInput = this.get('sightedInput');
      const tagsInputs = this.get('tagsInputs');
      const observableDescriptionInput = this.get('observableDescriptionInput');

      const observableInputs = {
        caseId: caseObj._id,
        inputs: {
          dataType: typeInput,
          tlp: observableTlpInput,
          data: valueInput,
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
        .then((data) => {
          console.log(JSON.stringify(data));
        })
        .catch((err) => {
          console.log(err);
          this.set('details.errorMessage', JSON.stringify(err, null, 4));
        })
        .finally(() => {
          this.set('isRunning', false);
          this.get('block').notifyPropertyChange('data');
        });
    },
    selectSeverityLevelAndSetInput: function (level, colorValue) {
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
    },
    selectLevelAndSetInput: function (level, colorValue, type) {
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
    }
  }
});
