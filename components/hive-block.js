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
    getSeverityInputAndSeverityColor: function (severityLevel, color) {
      this.set('severityInput', severityLevel);
      this.set(`${severityLevel}Severity`, color);

      ['low', 'medium', 'high', 'critical'].forEach((level) => {
        if (level !== severityLevel) {
          this.set(`${level}Severity`, '');
        }
      });
    },
    getTlpInputAndToggleColor: function (tlpLevel, color) {
      this.set('tlpInput', tlpLevel);
      this.set(`${tlpLevel}Tlp`, color);

      ['white', 'green', 'amber', 'red'].forEach((level) => {
        if (level !== tlpLevel) {
          this.set(`${level}Tlp`, '');
        }
      });
    },
    getPapInputAndToggleColor: function (papLevel, color) {
      this.set('papInput', papLevel);
      this.set(`${papLevel}Pap`, color);

      ['white', 'green', 'amber', 'red'].forEach((level) => {
        if (level !== papLevel) {
          this.set(`${level}Pap`, '');
        }
      });
    }
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
