'use strict';

polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  changeTab: 'cases',
  levels: { white: '#5bc0de', green: '#5cb85c', amber: '#f0ad4e', red: '#d9534f' },
  severityLevels: { L: '#5cb85c', M: '#5bc0de', H: '#f0ad4e', '!!': '#d9534f' },
  titleInput: '',
  severityInput: '',
  tlpInput: '',
  papInput: '',
  dateInput: '',
  currentSeverityElement: '',
  currentTlpElement: '',
  currentPapElement: '',
  enableAddObservable: true,
  modalOpen: false,
  caseCreated: false,
  isRunning: false,
  LEVELS: {
    white: '1',
    green: '2',
    amber: '3',
    red: '4'
  },
  init() {
    this.set('changeTab', this.get('details.length') ? 'cases' : 'create');
    this._super(...arguments);
  },
  actions: {
    changeTab: function (tabName) {
      this.set('changeTab', tabName);
    },
    submit: function () {
      this.set('isRunning', true);
      this.set('errorMessage', '');
      const title = this.get('titleInput');
      const severity = Number(this.get('severityInput'));
      const description = this.get('descriptionInput');
      const tlp = Number(this.get('tlpInput'));
      const pap = Number(this.get('papInput'));
      const date = this.get('dateInput');

      const caseInputs = {
        date,
        description,
        title,
        severity,
        tlp,
        pap
      };

      console.log('INPUTS:', JSON.stringify(caseInputs));
      this.sendIntegrationMessage({
        action: 'createCase',
        data: { caseInputs }
      })
        .then((data) => {
          if (data.statusCode === 201) {
            this.set('enableAddObservable', false);
            this.set('caseCreated', true);

            setTimeout(() => {
              this.set('caseCreated', false);
            }, 5000);
          }
        })
        .catch((err) => {
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
      if (level !== this.get('currentSeverityElement')) {
        const cachedElementValue = this.get('currentSeverityElement');
        let cachedElement = document.getElementById(`severity-${cachedElementValue}`);

        if (cachedElement) {
          cachedElement.style['background-color'] = '#d2d6de';
        }

        this.set('currentSeverityElement', level);
        let element = document.getElementById(`severity-${level}`);
        if (element) {
          element.style['background-color'] = `${colorValue}`;
        }
      }

      this.set('currentSeverityElement', level);
    },
    selectLevelAndSetInput: function (level, colorValue, type) {
      // Rather than have another method for selecting pap levels, this will take
      // a type in order to set the inputs and style properties
      const LEVELS = {
        white: '1',
        green: '2',
        amber: '3',
        red: '4'
      };

      this.set(`${type === 'tlp' ? 'tlpInput' : 'papInput'}`, LEVELS[level]);
      const currentElement = type === 'tlp' ? 'currentTlpElement' : 'currentPapElement';
      if (level !== this.get(`${currentElement}`)) {
        const cachedElementValue = this.get(`${currentElement}`);
        let cachedElement = document.getElementById(`${type}-${cachedElementValue}`);

        if (cachedElement) {
          cachedElement.style['background-color'] = '#d2d6de';
        }

        this.set(`${currentElement}`, level);
        let element = document.getElementById(`${type}-${level}`);
        if (element) {
          element.style['background-color'] = `${colorValue}`;
        }
      }
      this.set(`${currentElement}`, level);
    },

    toggleShowModal: function () {
      this.toggleProperty('modalOpen');
    }
  },
  setErrorMessages: function (index, prefix, message) {
    this.set(
      `${prefix}ErrorMessages`,
      Object.assign({}, this.get(`${prefix}ErrorMessages`), {
        [index]: message
      })
    );
  },
  setIsRunning: function (index, prefix, value) {
    this.set(`${prefix}IsRunning`, Object.assign({}, this.get(`${prefix}IsRunning`), { [index]: value }));
  }
});
