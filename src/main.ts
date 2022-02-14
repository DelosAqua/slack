import * as core from '@actions/core'
import * as yaml from 'js-yaml'
import {ConfigOptions, SlackInfoOptions, send} from './slack'
import {existsSync, readFileSync} from 'fs'

async function run(): Promise<void> {
  try {
    // debug output of environment variables and event payload
    for (const k of Object.keys(process.env).sort((a, b) => a.localeCompare(b))) {
      core.debug(`${k} = ${process.env[k]}`)
    }
    const event = process.env.GITHUB_EVENT_PATH as string
    const readEvent = (): object => JSON.parse(readFileSync(event, 'utf8'))
    core.debug(JSON.stringify(readEvent()))

    const configFile = core.getInput('config', {required: false})
    let config: ConfigOptions = {}
    try {
      core.info(`Reading config file ${configFile}...`)
      if (existsSync(configFile)) {
        config = yaml.load(readFileSync(configFile, 'utf-8'), {schema: yaml.FAILSAFE_SCHEMA}) as ConfigOptions
      }
    } catch (error) {
      if (error instanceof Error) core.info(error.message)
    }
    core.debug(yaml.dump(config))

    const slackInfoFile = core.getInput('slack_info', {required: false})
    let slackInfo: SlackInfoOptions = {}
    try {
      core.info(`Reading slack config file ${slackInfoFile}...`)
      if (existsSync(slackInfoFile)) {
        slackInfo = yaml.load(readFileSync(slackInfoFile, 'utf-8'), {schema: yaml.FAILSAFE_SCHEMA}) as SlackInfoOptions
      }
    } catch (error) {
      if (error instanceof Error) core.info(error.message)
    }
    core.debug(yaml.dump(slackInfo))

    const url = process.env.SLACK_WEBHOOK_URL as string
    const jobName = process.env.GITHUB_JOB as string
    const jobStatus = core.getInput('status', {required: true}).toUpperCase()
    const jobSteps = JSON.parse(core.getInput('steps', {required: false}) || '{}')
    const allowedSteps = config?.filter?.steps || []
    const filteredSteps = Object.keys(allowedSteps).length ?
      Object.keys(jobSteps).filter(k => allowedSteps.includes(k)).reduce((obj, k) => {
        obj = {...obj, ...{[k]: jobSteps[k]}}
        return obj
      }, {}) : jobSteps
    const channel = core.getInput('channel', {required: false})
    const message = core.getInput('message', {required: false})
    core.debug(`jobName: ${jobName}, jobStatus: ${jobStatus}`)
    core.debug(`channel: ${channel}, message: ${message}`)
    config.show_author = core.getInput('show_author', {required: false}) === "true" ? true : false

    if (url) {
      await send(url, jobName, jobStatus, filteredSteps, channel, message, config, slackInfo)
      core.debug('Sent to Slack.')
    } else {
      core.info('No "SLACK_WEBHOOK_URL" secret configured. Skip.')
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
