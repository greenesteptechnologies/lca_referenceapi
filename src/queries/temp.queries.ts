export const GET_COUNTRIES = `
  SELECT CountryId, CountryName
  FROM lca_common.Country
  WHERE IsActive = @isActive
  ORDER BY CountryName
`;