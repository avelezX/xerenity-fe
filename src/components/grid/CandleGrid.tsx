import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Card, Table } from 'react-bootstrap'
import React,{ useState, useEffect, useCallback } from "react"
import { Canasta,CanastaInflacion } from '@models/canasta'
import Container from 'react-bootstrap/Container'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import NavDropdown from 'react-bootstrap/NavDropdown'
import Nav from 'react-bootstrap/Nav'
import DisplaySerie from '@components/compare/CompareSeries'
import Form from 'react-bootstrap/Form';
import {Tes,TesYields,CandleSerie} from '@models/tes'
import { GridEntry } from '@models/tes'

export interface GridViewProps{
    selectCallback:any;
    allTes:GridEntry[]
}

export default function CandleGridViewer({selectCallback,allTes}:GridViewProps){

    const supabase = createClientComponentClient()     

    return (        
        <Form onChange={selectCallback}>
            <Table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Open</th>
                    <th>Close</th>
                    <th>Low</th>
                    <th>High</th>
                    <th>Volume</th>
                  </tr>
                </thead>                
                    <tbody>
                        {
                            allTes.map((tesValue)=>[
                                <tr>
                                    <td>
                                        <Form.Check inline type={'radio'} label={tesValue.tes} name="group1" id={tesValue.tes} />                                
                                    </td>                                
                                    <td>{tesValue.open}</td>
                                    <td>{tesValue.close}</td>
                                    <td>{tesValue.low}</td>
                                    <td>{tesValue.high}</td>
                                    <td>{tesValue.volume}</td>                                
                                </tr>
                            ])
                        }
                    </tbody>                
            </Table>
        </Form>
    )
}