# Polarity - TheHive Integration

TheHive is a scalable 4-in-1 open source and free security incident response platform designed to make life easier for SOCs, CSIRTs, CERTs and any information security practitioner dealing with security incidents that need to be investigated and acted upon swiftly.

The Polarity TheHive integration allows Polarity to search TheHive's Search API to return threat information on IP's, Domains and URL's.

For more information on TheHive, please visit [official website](https://thehive-project.org/).

Check out the integration in action:

![thehive](https://user-images.githubusercontent.com/22529325/56053166-5c93ba00-5d21-11e9-96a6-ea2b02ace95a.gif)

## TheHive Integration Options

### TheHive Host
The host of your TheHive instance

### TheHive API Key

TheHive API key

### Ignore List

This is an alternate option that can be used to specify domains or IPs that you do not want sent to TheHive.  The data must specify the entire IP or domain to be blocked (e.g., www.google.com is treated differently than google.com).

### Ignore Domain Regex

This option allows you to specify a regex to set domains.  Any domain matching the regex will not be looked up.

### Ignore IP Regex

This option allows you to specify a regex to set IPv4 Addresses. Any IPv4 matching the regex will not be looked up.

## Installation Instructions

Installation instructions for integrations are provided on the [PolarityIO GitHub Page](https://polarityio.github.io/).

## Polarity

Polarity is a memory-augmentation platform that improves and accelerates analyst decision making.  For more information about the Polarity platform please see:

https://polarity.io/
