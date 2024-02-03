import { IconProp } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {Button,Modal} from 'react-bootstrap'

interface ModalProps{
    cancelCallback:() => void;
    cancelMessage:string;
    saveCallback:() => void;
    saveMessage:string;
    title:string;
    message:string;
    display:boolean;
    icon: IconProp;
}

function SimpleModal({display,cancelCallback,cancelMessage,saveCallback,saveMessage,title,message,icon}:ModalProps) {
  return (
    <div
      className="modal show"
      style={{ display: 'block', position: 'initial' }}
    >
      <Modal show={display} onHide={cancelCallback}>
        <Modal.Header closeButton>
            <Modal.Title>
            <FontAwesomeIcon icon={icon}/>{' '}{title}
                                
            </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <p>{message}</p>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="primary" onClick={cancelCallback}>{cancelMessage}</Button>
          <Button variant="danger" onClick={saveCallback}>{saveMessage}</Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export default SimpleModal