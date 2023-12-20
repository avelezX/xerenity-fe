
import { Button,Toast, Row,Col,Form} from 'react-bootstrap'
import React,{ useState, useEffect, ChangeEvent } from "react"
import Container from 'react-bootstrap/Container'
import { getHexColor,XerenityHexColors } from '@models/hexColors'
import Circle from '@uiw/react-color-circle'


export interface SeriePickerProps {
    handleSeriePick:(e: ChangeEvent<HTMLInputElement>,serieid:string,color:string) => void;
    handleColorPicker:(serieid:string,color:string) => void;
    displayName:string;
    serieID:string;
    disable:boolean;
    checked:boolean;
    showColor:boolean;
}

export default function SeriePicker({handleSeriePick,handleColorPicker,serieID,displayName,disable,checked,showColor}:SeriePickerProps){

    const [idserie,setIdSerie] = useState('')

    const [serieColor,setSerieColor] = useState('')

    const [showColorToast,setShowColorToast] = useState(false)

    const HandleSerieSelect = async (event: ChangeEvent<HTMLInputElement>,newId:string)=>{
        setIdSerie(newId)
        handleSeriePick(event,newId,serieColor)
    }

    const HandleColorSelect = async (color: { hex: React.SetStateAction<string> })=>{
        
        setSerieColor(color.hex)
        if(handleColorPicker){
            handleColorPicker(idserie,color.hex.toString())
        }
        
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
                    {showColor?
                    (
                        <Col>
                            <Button size="sm" variant="outline-primary" onClick={()=>setShowColorToast(!showColorToast)}>
                                Color
                            </Button>
                        </Col>
                    ):
                    (null)
                    }
                    
            </Row>
            {showColor?
            (
                <Row>
                    <Col>
                    <Toast  onClose={()=>setShowColorToast(false)} show={showColorToast} animation>
                        <Toast.Body>                            
                            <Circle style={{ width: '100%', height: '100%', }} onChange={HandleColorSelect} colors={XerenityHexColors}/>
                        </Toast.Body>
                        </Toast>
                    </Col>
                </Row>
            ):(null)

            }

        </Container>
    )
}
