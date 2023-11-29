import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Table } from 'react-bootstrap'
import React from "react"
import Form from 'react-bootstrap/Form'
import { GridEntry } from '@models/tes'
import NewPrevTag from '@components/price/NewPrevPriceTag'

export interface GridViewProps{
    selectCallback:any;
    allTes:GridEntry[]
}

export default function CandleGridViewer({selectCallback,allTes}:GridViewProps){

    const supabase = createClientComponentClient()     

    return (        
                <Form onChange={selectCallback}>
                    <Table hover>
                        <thead>
                        <tr>
                            <th>Name</th>
                            
                            <th>Change</th>
                            
                            <th>Last</th>

                            <th>Prev</th>
                            
                            <th>Open</th>

                            <th>Low</th>
                            
                            <th>High</th>

                            <th>Volume</th>

                            <th>Date/Hour</th>
                        </tr>
                        </thead>                
                            <tbody>
                                {
                                    allTes.map((tesValue)=>[
                                        <tr>
                                            <td>
                                                <Form.Check inline placeholder={tesValue.displayname} type={'radio'} label={tesValue.displayname} name="group1" id={tesValue.tes}  />                                
                                            </td>
                                            <td>                                        
                                                <NewPrevTag current={tesValue.close} prev={tesValue.prev} > 
                                                    <td>{tesValue.prev.toFixed(3)} PBS</td>
                                                </NewPrevTag>
                                            </td>
                                            <td>{tesValue.close.toPrecision(3)}</td>
                                            <td>{tesValue.prev.toPrecision(3)}</td>
                                            <td>{tesValue.open.toPrecision(3)}</td>
                                            <td>{tesValue.low.toPrecision(3)}</td>
                                            <td>{tesValue.high.toPrecision(3)}</td>
                                            <td>{(tesValue.volume/1000000000).toPrecision(3)} MMM</td>
                                            <td>{tesValue.operation_time}</td>
                                        </tr>
                                    ])
                                }
                            </tbody>                
                    </Table>
                </Form>
    )
}