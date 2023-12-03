
import { Button,Toast, Row,Col,Form} from 'react-bootstrap'
import React,{ useState, useEffect, ChangeEvent } from "react"
import Container from 'react-bootstrap/Container'
import {SwatchesPicker} from "react-color"
import { getHexColor } from '@models/hexColors'

export interface SeriePickerProps {
    handleSeriePick:(e: ChangeEvent<HTMLInputElement>,serieid:string,color:string) => void;
    handleColorPicker:(serieid:string,color:string) => void;
    displayName:string;
    serieID:string;
    disable:boolean;
    checked:boolean;
}

export default function SeriePicker({handleSeriePick,handleColorPicker,serieID,displayName,disable,checked}:SeriePickerProps){

    const [idserie,setIdSerie] = useState('')

    const [serieColor,setSerieColor] = useState('')

    const [showColorToast,setShowColorToast] = useState(false)

    const HandleSerieSelect = async (event: ChangeEvent<HTMLInputElement>,newId:string)=>{
        setIdSerie(newId)
        handleSeriePick(event,newId,serieColor)
    }

    const HandleColorSelect = async (color: { hex: React.SetStateAction<string> })=>{
        
        setSerieColor(color.hex)
        handleColorPicker(idserie,color.hex.toString())
    }

    useEffect(()=>{
        setIdSerie(serieID)
        setSerieColor(getHexColor(0))
    },[setIdSerie,serieID])
    

    return (
        <Container fluid>
            <Row>                
                <Col sm={8}>                        
                    <Form.Check // prettier-ignore
                            type="switch"
                            id={`${idserie}-picker`}
                            label={displayName}
                            disabled={disable}
                            checked={checked}
                            onChange={(e)=> HandleSerieSelect(e, serieID)}
                        />
                    </Col>
                    <Col>
                        <Button size="sm" variant="outline-primary" onClick={()=>setShowColorToast(!showColorToast)}>
                            Color
                        </Button>
                    </Col>
            </Row>
            <div>
                <Toast   onClose={()=>setShowColorToast(false)} show={showColorToast} animation>                
                    <Toast.Header closeButton>
                        Seleccione un color
                    </Toast.Header>
                    <Toast.Body >
                        <SwatchesPicker onChangeComplete={HandleColorSelect}/>
                    </Toast.Body>
                </Toast>
            </div>
        </Container>
    )
}
