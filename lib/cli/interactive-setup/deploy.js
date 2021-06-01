'use strict';

const Serverless = require('../../Serverless');
const chalk = require('chalk');
const { confirm } = require('./utils');
const _ = require('lodash');
const overrideStdoutWrite = require('process-utils/override-stdout-write');
const AWS = require('aws-sdk');

// TODO: CHANGE THE FORMATTING
const printMessage = (serviceName, hasBeenDeployed) => {
  if (hasBeenDeployed) {
    process.stdout.write(
      `\n${chalk.green('Your new project is live and available in ')}${chalk.white.bold(
        serviceName
      )}\n`
    );
  } else {
    process.stdout.write(
      `\n${chalk.green('Your new project is available in ')}${chalk.white.bold(serviceName)}\n`
    );
  }

  process.stdout.write('\nInside that directory, you can run serveral commands:\n');
  process.stdout.write(`\n  ${chalk.blue('serverless info')}\n`);
  process.stdout.write('    View deployment and configuration details.\n');
  process.stdout.write(`\n  ${chalk.blue('serverless deploy')}\n`);
  if (hasBeenDeployed) {
    process.stdout.write('    Deploy your service again.\n');
  } else {
    process.stdout.write('    Deploy your service.\n');
  }
  process.stdout.write(`\n  ${chalk.blue('serverless dashboard')}\n`);
  process.stdout.write('    Open the dashboard to view metrics, logs and alerts.\n\n');
};

// TODO: TESTS
const configurePlugin = (serverless, originalStdWrite) => {
  serverless.pluginManager.addPlugin(require('../../plugins/deploy-interactive'));
  const interactivePlugin = serverless.pluginManager.plugins.find(
    (plugin) => plugin.constructor.name === 'InteractiveDeployProgress'
  );
  interactivePlugin.progress._writeOriginalStdout = (data) => originalStdWrite(data);
  return interactivePlugin;
};

module.exports = {
  isApplicable({ configuration, serviceDir, history }) {
    if (!serviceDir) {
      return false;
    }

    // We only want to consider newly created services for deploy step
    if (!history.has('service')) {
      return false;
    }

    if (
      _.get(configuration, 'provider') !== 'aws' &&
      _.get(configuration, 'provider.name') !== 'aws'
    ) {
      return false;
    }

    // We want to proceed if local credentials are available
    if (new AWS.S3().config.credentials) return true;

    // TODO: CHECK IF PROVIDER HAS BEEN SETUP DURING AWS CREDETIALS STEP

    return true;
  },
  async run({ configuration, configurationFilename, serviceDir }) {
    const serviceName = configuration.service;
    if (!(await confirm('Do you want to deploy your project?', { name: 'shouldDeploy' }))) {
      printMessage(serviceName, false);
      return;
    }

    // TODO: TESTS

    const serverless = new Serverless({
      configuration,
      serviceDir,
      configurationFilename,
      isConfigurationResolved: true,
      hasResolvedCommandsExternally: true,
      isTelemetryReportedExternally: true,
      commands: ['deploy'],
      options: {},
    });

    let interactiveOutputPlugin;

    try {
      await overrideStdoutWrite(
        () => {},
        async (originalStdWrite) => {
          await serverless.init();
          interactiveOutputPlugin = configurePlugin(serverless, originalStdWrite);
          await serverless.run();
        }
      );
    } catch (err) {
      interactiveOutputPlugin.handleError();
      throw err;
    }

    printMessage(serviceName, true);
  },
};
