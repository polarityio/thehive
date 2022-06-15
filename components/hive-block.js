'use strict';

polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  changeTab: 'cases',
  titleInput: '',
  whiteSeverity: '',
  greenSeverity: '',
  amberSeverity: '',
  redSeverity: '',
  severityInput: '',
  whiteTlp: '',
  greenTlp: '',
  amberTlp: '',
  redTlp: '',
  tlpInput: '',
  whitePap: '',
  greenPap: '',
  amberPap: '',
  redPap: '',
  papInput: '',
  enableAddObservable: true,
  modalOpen: false,
  caseCreated: false,
  isRunning: false,
  COLOR_VALUES: {
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
      const title = this.get('titleInput');
      const severity = Number(this.get('severityInput'));
      const description = this.get('descriptionInput');
      const tlp = Number(this.get('tlpInput'));
      const pap = Number(this.get('papInput'));

      const caseInputs = {
        description,
        title,
        severity,
        tlp,
        pap
      };

      console.log('inputs', JSON.stringify(caseInputs));
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
          console.log(err);
        })
        .finally(() => {
          this.set('isRunning', false);
          this.get('block').notifyPropertyChange('data');
        });
    },
    // addObservable: function () {

    //   this.sendIntegrationMessage({
    //     action: 'addObservable',
    //     data: {}
    //   });
    // },
    getSeverityInputAndSeverityColor: function (severityLevel, color) {
      this.set('severityInput', this.COLOR_VALUES[severityLevel]);
      this.set(`${severityLevel}Severity`, color);

      ['white', 'green', 'amber', 'red'].forEach((level) => {
        if (level !== severityLevel) {
          this.set(`${level}Severity`, '');
        }
      });
    },
    getTlpInputAndToggleColor: function (tlpLevel, color) {
      this.set('tlpInput', this.COLOR_VALUES[tlpLevel]);
      this.set(`${tlpLevel}Tlp`, color);

      ['white', 'green', 'amber', 'red'].forEach((level) => {
        if (level !== tlpLevel) {
          this.set(`${level}Tlp`, '');
        }
      });
    },
    getPapInputAndToggleColor: function (papLevel, color) {
      this.set('papInput', this.COLOR_VALUES[papLevel]);
      this.set(`${papLevel}Pap`, color);

      ['white', 'green', 'amber', 'red'].forEach((level) => {
        if (level !== papLevel) {
          this.set(`${level}Pap`, '');
        }
      });
    },
    showMessage: function () {
      this.set('caseCreatedMessage', true);
      setTimeout(() => {
        this.set('caseCreatedMessage', false);
      }, 3000);
    },
    flashElement: function (element, flashCount = 3, flashTime = 280) {
      if (!flashCount) return;
      element.classList.add('highlight');
      setTimeout(() => {
        element.classList.remove('highlight');
        setTimeout(() => this.flashElement(element, flashCount - 1), flashTime);
      }, flashTime);
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
