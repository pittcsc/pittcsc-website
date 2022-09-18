const getAcademicYear = () => {
  const currYear = new Date().getFullYear();
  const currMonth = new Date().getMonth();
  if (currMonth > 7) {
    return currYear + "-" + String(parseInt(currYear) + 1);
  } else {
    return currYear - 1 + "-" + currYear;
  }
};

export { getAcademicYear };
