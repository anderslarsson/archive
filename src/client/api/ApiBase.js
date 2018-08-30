import request from 'superagent';
import ApiError from './ApiError';

class ApiBase {
    ajax = request;

    getErrorFromResponse(e) {
        if (e)
            throw new ApiError((e.response && e.response.body && e.response.body.message) || e.body || e.message, e.response.status);

        throw new Error('An unknown error occured.');
    }
}

export default ApiBase;
