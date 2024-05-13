const truncateStr = (string = '', maxLength = 50) =>
  string.length > maxLength ? `${string.substring(0, maxLength)}…` : string;

export default truncateStr;
