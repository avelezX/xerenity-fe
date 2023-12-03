export const hexColors=[
    '#238F9E',
    '#2087ae',
    '#4a7cb5',
    '#766cad',
    '#985a95',
    '#ac4a72',
    '#456A8B',
    '#596d97',
    '#716f9f',
    '#8c6fa2',    
    '#2270E2',
    '#6868d6',
    '#8b61c8',
    '#a35bb8',
    '#b356a7',
    '#bd5596',
    '#a66f9f',
    '#be6f97',
    '#B34738',
    '#9c621b',
    '#79781f',
    '#508743',
    '#019071',
    '#00959d',
    '#212121',
    '#3c3e42',
    '#545f66',
    '#6c8389',
    '#87a8a7',
    '#a9cec2'
]

export function getHexColor(index:number){
    return hexColors[index % hexColors.length]
}
