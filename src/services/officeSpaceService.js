import api from './api';

/**
 * Office spaces exist here for one reason: every credit-charging endpoint
 * refuses a non-admin caller without an `officeSpaceId`, because that is the
 * shop whose credit balance the generation is billed to.
 */
const officeSpaceService = {
  list: () => api.get('/api/office-spaces'),
};

export default officeSpaceService;
