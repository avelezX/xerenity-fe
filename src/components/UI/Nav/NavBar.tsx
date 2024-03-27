import { Nav } from 'react-bootstrap';
import React, { PropsWithChildren } from 'react';


export default function NavigationBar (props: PropsWithChildren)  {
    
    const { children } = props;

    return (
        <div className="bg-white d-flex flex-column justify-content-center">
            <Nav variant="pills" >
                {children}
            </Nav>
        </div>
    );
};
