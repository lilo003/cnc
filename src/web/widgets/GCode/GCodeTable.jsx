import classNames from 'classnames';
import colornames from 'colornames';
import React, { Component, PropTypes } from 'react';
import shallowCompare from 'react-addons-shallow-compare';
import { Column, Table } from 'react-virtualized';
import {
    GCODE_STATUS_ERROR,
    GCODE_STATUS_NOT_STARTED,
    GCODE_STATUS_IN_PROGRESS,
    GCODE_STATUS_COMPLETED
} from './constants';
import styles from './index.styl';

class GCodeTable extends Component {
    static propTypes = {
        rows: PropTypes.array.isRequired,
        scrollToRow: PropTypes.number
    };
    static defaultProps = {
        rows: [],
        scrollToRow: 0
    };

    shouldComponentUpdate(nextProps, nextState) {
        return shallowCompare(this, nextProps, nextState);
    }
    render() {
        const { rows, scrollToRow } = this.props;
        const headerHeight = 32;
        const rowHeight = 30;
        const visibleRows = 6;
        const height = headerHeight + rowHeight * visibleRows;
        const width = 320;
        const offset = (visibleRows % 2 === 0) ? 0 : 1;
        const scrollToIndex = Math.max(0, (scrollToRow - 1) + (Math.ceil(visibleRows / 2) - offset));

        return (
            <div className={styles['gcode-table']}>
                <Table
                    disableHeader={true}
                    headerHeight={headerHeight}
                    height={height}
                    rowGetter={({ index }) => {
                        return rows[index];
                    }}
                    rowHeight={rowHeight}
                    rowCount={rows.length}
                    scrollToIndex={scrollToIndex}
                    width={width}
                >
                    <Column
                        className={styles['gcode-table-cell-status']}
                        cellRenderer={({ cellData, columnData, dataKey, rowData, rowIndex }) => {
                            const value = rowData.status;
                            const classes = {
                                icon: classNames(
                                    'fa',
                                    { 'fa-check': value !== GCODE_STATUS_ERROR },
                                    { 'fa-ban': value === GCODE_STATUS_ERROR }
                                )
                            };
                            const styles = {
                                icon: {
                                    color: (() => {
                                        const color = {};
                                        color[GCODE_STATUS_ERROR] = colornames('indian red');
                                        color[GCODE_STATUS_NOT_STARTED] = colornames('gray 80');
                                        color[GCODE_STATUS_IN_PROGRESS] = colornames('gray 80');
                                        color[GCODE_STATUS_COMPLETED] = colornames('gray 20');
                                        return color[value] || colornames('gray 80');
                                    })()
                                }
                            };

                            return (
                                <i className={classes.icon} style={styles.icon} />
                            );
                        }}
                        dataKey="status"
                        width={30}
                    />
                    <Column
                        className={styles['gcode-table-cell-command']}
                        cellRenderer={({ cellData, columnData, dataKey, rowData, rowIndex }) => {
                            const value = rowData.cmd;
                            const style = {
                                backgroundColor: colornames('gray 25'),
                                marginRight: 5
                            };

                            return (
                                <div>
                                    <span className="label" style={style}>{rowIndex + 1}</span>{value}
                                </div>
                            );
                        }}
                        dataKey="cmd"
                        flexGrow={1}
                        width={290}
                    />
                </Table>
            </div>
        );
    }
}

export default GCodeTable;
