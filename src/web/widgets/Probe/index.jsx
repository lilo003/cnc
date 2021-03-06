import _, { includes } from 'lodash';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
import React, { Component, PropTypes } from 'react';
import shallowCompare from 'react-addons-shallow-compare';
import Widget from '../../components/Widget';
import i18n from '../../lib/i18n';
import { in2mm, mm2in } from '../../lib/units';
import controller from '../../lib/controller';
import store from '../../store';
import Probe from './Probe';
import {
    // Units
    IMPERIAL_UNITS,
    METRIC_UNITS,
    // Grbl
    GRBL,
    GRBL_ACTIVE_STATE_IDLE,
    // TinyG2
    TINYG2,
    TINYG2_MACHINE_STATE_READY,
    TINYG2_MACHINE_STATE_STOP,
    TINYG2_MACHINE_STATE_END,
    // Workflow
    WORKFLOW_STATE_IDLE
} from '../../constants';
import styles from './index.styl';

const toUnits = (units, val) => {
    val = Number(val) || 0;
    if (units === IMPERIAL_UNITS) {
        val = mm2in(val).toFixed(4) * 1;
    }
    if (units === METRIC_UNITS) {
        val = val.toFixed(3) * 1;
    }

    return val;
};

class ProbeWidget extends Component {
    static propTypes = {
        onDelete: PropTypes.func,
        sortable: PropTypes.object
    };
    static defaultProps = {
        onDelete: () => {}
    };

    actions = {
        changeProbeCommand: (value) => {
            this.setState({ probeCommand: value });
        },
        handleProbeDepthChange: (event) => {
            const probeDepth = event.target.value;
            this.setState({ probeDepth });
        },
        handleProbeFeedrateChange: (event) => {
            const probeFeedrate = event.target.value;
            this.setState({ probeFeedrate });
        },
        handleTLOChange: (event) => {
            const tlo = event.target.value;
            this.setState({ tlo });
        },
        handleRetractionDistanceChange: (event) => {
            const retractionDistance = event.target.value;
            this.setState({ retractionDistance });
        },
        runZProbe: () => {
            const { probeCommand, probeDepth, probeFeedrate, tlo, retractionDistance } = this.state;
            const towardWorkpiece = _.includes(['G38.2', 'G38.3'], probeCommand);

            // Set relative distance mode
            this.sendCommand('G91');

            // Start Z-probing
            this.sendCommand(probeCommand, {
                Z: towardWorkpiece ? -probeDepth : probeDepth,
                F: probeFeedrate
            });

            // Set back to asolute distance mode
            this.sendCommand('G90');

            // Zero out work z axis
            this.sendCommand('G10', {
                L: 20,
                P: 1,
                Z: tlo
            });

            // Set relative distance mode
            this.sendCommand('G91');

            // Retract slightly from the touch plate
            this.sendCommand('G0', {
                Z: retractionDistance
            });

            // Set back to asolute distance mode
            this.sendCommand('G90');
        }
    };
    controllerEvents = {
        'Grbl:state': (state) => {
            const { parserstate } = { ...state };
            const { modal = {} } = { ...parserstate };
            const units = {
                'G20': IMPERIAL_UNITS,
                'G21': METRIC_UNITS
            }[modal.units] || this.state.units;

            let {
                probeDepth,
                probeFeedrate,
                tlo,
                retractionDistance
            } = store.get('widgets.probe');
            if (units === IMPERIAL_UNITS) {
                probeDepth = mm2in(probeDepth).toFixed(4) * 1;
                probeFeedrate = mm2in(probeFeedrate).toFixed(4) * 1;
                tlo = mm2in(tlo).toFixed(4) * 1;
                retractionDistance = mm2in(retractionDistance).toFixed(4) * 1;
            }
            if (units === METRIC_UNITS) {
                probeDepth = Number(probeDepth).toFixed(3) * 1;
                probeFeedrate = Number(probeFeedrate).toFixed(3) * 1;
                tlo = Number(tlo).toFixed(3) * 1;
                retractionDistance = Number(retractionDistance).toFixed(3) * 1;
            }

            if (this.state.units !== units) {
                // Set `this.unitsDidChange` to true if the unit has changed
                this.unitsDidChange = true;
            }

            this.setState({
                units: units,
                controller: {
                    type: GRBL,
                    state: state
                },
                probeDepth: probeDepth,
                probeFeedrate: probeFeedrate,
                tlo: tlo,
                retractionDistance: retractionDistance
            });
        },
        'TinyG2:state': (state) => {
            const { sr } = { ...state };
            const { modal = {} } = sr;
            const units = {
                'G20': IMPERIAL_UNITS,
                'G21': METRIC_UNITS
            }[modal.units] || this.state.units;

            let {
                probeDepth,
                probeFeedrate,
                tlo,
                retractionDistance
            } = store.get('widgets.probe');
            if (units === IMPERIAL_UNITS) {
                probeDepth = mm2in(probeDepth).toFixed(4) * 1;
                probeFeedrate = mm2in(probeFeedrate).toFixed(4) * 1;
                tlo = mm2in(tlo).toFixed(4) * 1;
                retractionDistance = mm2in(retractionDistance).toFixed(4) * 1;
            }
            if (units === METRIC_UNITS) {
                probeDepth = Number(probeDepth).toFixed(3) * 1;
                probeFeedrate = Number(probeFeedrate).toFixed(3) * 1;
                tlo = Number(tlo).toFixed(3) * 1;
                retractionDistance = Number(retractionDistance).toFixed(3) * 1;
            }

            if (this.state.units !== units) {
                // Set `this.unitsDidChange` to true if the unit has changed
                this.unitsDidChange = true;
            }

            this.setState({
                units: units,
                controller: {
                    type: TINYG2,
                    state: state
                },
                probeDepth: probeDepth,
                probeFeedrate: probeFeedrate,
                tlo: tlo,
                retractionDistance: retractionDistance
            });
        }
    };
    unitsDidChange = false;
    pubsubTokens = [];

    constructor() {
        super();
        this.state = this.getDefaultState();
    }
    componentDidMount() {
        this.subscribe();
        this.addControllerEvents();
    }
    componentWillUnmount() {
        this.unsubscribe();
        this.removeControllerEvents();
    }
    shouldComponentUpdate(nextProps, nextState) {
        return shallowCompare(this, nextProps, nextState);
    }
    componentDidUpdate(prevProps, prevState) {
        const {
            minimized
        } = this.state;

        store.set('widgets.probe.minimized', minimized);

        // Do not save to store if the units did change between in and mm
        if (this.unitsDidChange) {
            this.unitsDidChange = false;
            return;
        }

        const { units, probeCommand } = this.state;
        let {
            probeDepth,
            probeFeedrate,
            tlo,
            retractionDistance
        } = this.state;

        if (units === IMPERIAL_UNITS) {
            probeDepth = in2mm(probeDepth);
            probeFeedrate = in2mm(probeFeedrate);
            tlo = in2mm(tlo);
            retractionDistance = in2mm(retractionDistance);
        }

        // To save in mm
        store.set('widgets.probe.probeCommand', probeCommand);
        store.set('widgets.probe.probeDepth', Number(probeDepth));
        store.set('widgets.probe.probeFeedrate', Number(probeFeedrate));
        store.set('widgets.probe.tlo', Number(tlo));
        store.set('widgets.probe.retractionDistance', Number(retractionDistance));
    }
    getDefaultState() {
        return {
            minimized: store.get('widgets.probe.minimized', false),
            isFullscreen: false,
            canClick: true, // Defaults to true
            port: controller.port,
            units: METRIC_UNITS,
            controller: {
                type: controller.type,
                state: controller.state
            },
            workflowState: controller.workflowState,
            probeCommand: store.get('widgets.probe.probeCommand'),
            probeDepth: toUnits(METRIC_UNITS, store.get('widgets.probe.probeDepth')),
            probeFeedrate: toUnits(METRIC_UNITS, store.get('widgets.probe.probeFeedrate')),
            tlo: toUnits(METRIC_UNITS, store.get('widgets.probe.tlo')),
            retractionDistance: toUnits(METRIC_UNITS, store.get('widgets.probe.retractionDistance'))
        };
    }
    subscribe() {
        const tokens = [
            pubsub.subscribe('port', (msg, port) => {
                port = port || '';

                if (port) {
                    this.setState({ port: port });
                } else {
                    const defaultState = this.getDefaultState();
                    this.setState({
                        ...defaultState,
                        port: ''
                    });
                }
            }),
            pubsub.subscribe('workflowState', (msg, workflowState) => {
                if (this.state.workflowState !== workflowState) {
                    this.setState({ workflowState: workflowState });
                }
            })
        ];
        this.pubsubTokens = this.pubsubTokens.concat(tokens);
    }
    unsubscribe() {
        this.pubsubTokens.forEach((token) => {
            pubsub.unsubscribe(token);
        });
        this.pubsubTokens = [];
    }
    addControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.on(eventName, callback);
        });
    }
    removeControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.off(eventName, callback);
        });
    }
    canClick() {
        const { port, workflowState } = this.state;
        const controllerType = this.state.controller.type;
        const controllerState = this.state.controller.state;

        if (!port) {
            return false;
        }
        if (workflowState !== WORKFLOW_STATE_IDLE) {
            return false;
        }
        if (controllerType === GRBL) {
            const activeState = _.get(controllerState, 'status.activeState');
            const states = [
                GRBL_ACTIVE_STATE_IDLE
            ];
            if (!includes(states, activeState)) {
                return false;
            }
        }
        if (controllerType === TINYG2) {
            const machineState = _.get(controllerState, 'sr.machineState');
            const states = [
                TINYG2_MACHINE_STATE_READY,
                TINYG2_MACHINE_STATE_STOP,
                TINYG2_MACHINE_STATE_END
            ];
            if (!includes(states, machineState)) {
                return false;
            }
        }

        return true;
    }
    sendCommand(cmd, params) {
        const s = _.map(params, (value, letter) => String(letter + value)).join(' ');
        const gcode = (s.length > 0) ? (cmd + ' ' + s) : cmd;
        controller.command('gcode', gcode);
    }
    render() {
        const { minimized, isFullscreen } = this.state;
        const state = {
            ...this.state,
            canClick: this.canClick()
        };
        const actions = {
            ...this.actions
        };

        return (
            <Widget fullscreen={isFullscreen}>
                <Widget.Header className={this.props.sortable.handleClassName}>
                    <Widget.Title>{i18n._('Probe')}</Widget.Title>
                    <Widget.Controls className={this.props.sortable.filterClassName}>
                        <Widget.Button
                            title={minimized ? i18n._('Open') : i18n._('Close')}
                            onClick={(event, val) => this.setState({ minimized: !minimized })}
                        >
                            <i
                                className={classNames(
                                    'fa',
                                    { 'fa-chevron-up': !minimized },
                                    { 'fa-chevron-down': minimized }
                                )}
                            />
                        </Widget.Button>
                        <Widget.Button
                            title={i18n._('Fullscreen')}
                            onClick={(event, val) => this.setState({ isFullscreen: !isFullscreen })}
                        >
                            <i
                                className={classNames(
                                    'fa',
                                    { 'fa-expand': !isFullscreen },
                                    { 'fa-compress': isFullscreen }
                                )}
                            />
                        </Widget.Button>
                        <Widget.Button
                            title={i18n._('Remove')}
                            onClick={(event) => this.props.onDelete()}
                        >
                            <i className="fa fa-times" />
                        </Widget.Button>
                    </Widget.Controls>
                </Widget.Header>
                <Widget.Content
                    className={classNames(
                        styles['widget-content'],
                        { [styles.hidden]: minimized }
                    )}
                >
                    <Probe
                        state={state}
                        actions={actions}
                    />
                </Widget.Content>
            </Widget>
        );
    }
}

export default ProbeWidget;
