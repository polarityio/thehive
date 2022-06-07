'use strict';

polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  changeTab: 'cases',
  lowSeverity: '',
  mediumSeverity: '',
  highSeverity: '',
  criticalSeverity: '',
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
  actions: {
    changeTab: function (tabName) {
      this.set('changeTab', tabName);
    },
    submit: function () {
      const severity = Number(this.get('severityInput'));
      const title = this.get('titleInput');
      const description = this.get('descriptionInput');
      const tlp = this.get('tlpInput');

      const caseInputs = {
        description,
        severity,
        title,
        tlp
      };

      console.log(severity, title, description);

      this.sendIntegrationMessage({
        action: 'createCase',
        data: { caseInputs }
      })
        .then(({ statusCode }) => {
          console.log(statusCode);
          if (statusCode === 201) {
            this.set('caseCreatedMsg', 'Case was created!');
          }
        })
        .catch((err) => {
          this.set('details.errorMessage', JSON.stringify(err, null));
        });
    },
    selectSeverity: function (value, type, color) {
      if (type === 'severity') {
        this.toggleSeverityColor(value, color);
        this.set('severityInput', value);
      }
      if (type === 'tlp') {
        this.toggleTlpColor(value, color);
        this.set('tlpInput', value);
      }
      if (type === 'pap') {
        this.togglePapColor(value, color);
        this.set('papInput', value);
      }
    }
  },
  toggleSeverityColor: function (severityLevel, color) {
    this.set(`${severityLevel}Severity`, color);

    ['low', 'medium', 'high', 'critical'].forEach((level) => {
      if (level !== severityLevel) {
        this.set(`${level}Severity`, '');
      }
    });
  },
  toggleTlpColor: function (tlpLevel, color) {
    this.set(`${tlpLevel}Tlp`, color);

    ['white', 'green', 'amber', 'red'].forEach((color) => {
      if (color !== tlpLevel) {
        console.log(`${color}Tlp`);
        this.set(`${color}Tlp`, '');
      }
    });
  },
  togglePapColor: function (papLevel, color) {
    this.set(`${papLevel}Pap`, color);

    ['white', 'green', 'amber', 'red'].forEach((color) => {
      if (color !== papLevel) {
        console.log(`${color}Pap`);
        this.set(`${color}Pap`, '');
      }
    });
  },
  setErrorMessages: function (index, prefix, message) {
    this.set(
      `${prefix}ErrorMessages`,
      Object.assign({}, this.get(`${prefix}ErrorMessages`), {
        [index]: message
      })
    );
  }
});
