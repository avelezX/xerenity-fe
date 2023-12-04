export function ExportToCsv(data:string[][]){

    return data.map((row: string[]) =>
        row
        .map(String)  // convert every value to String
        .map(v => v.replaceAll('"', '""'))  // escape double quotes
        .map(v => `"${v}"`)  // quote it
        .join(',')  // comma-separated
      ).join('\r\n')  // rows starting on new lines
}

export function downloadBlob(content: BlobPart, filename: string, contentType: string) {
    // Create a blob
    const blob = new Blob([content], { type: contentType })
    const url = URL.createObjectURL(blob)
  
    // Create a link to download it
    const pom = document.createElement('a')
    pom.href = url
    pom.setAttribute('download', filename)
    pom.click()
  }