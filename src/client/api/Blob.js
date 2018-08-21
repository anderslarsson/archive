import ApiBase from './ApiBase';

class Blob extends ApiBase
{
    uploadFile(tenantId, path, file, createMissing = true)
    {
        return this.ajax.put(`/blob/api/${tenantId}/files/${path}`)
            .query({createMissing})
            .send(file)
            .then(res => res.body)
            .catch(this.getErrorFromResponse);
    }

    uploadFileAsFormData(tenantId, path, file, createMissing = true)
    {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', file.name);

        return this.uploadFile(tenantId, path, formData, createMissing);
    }
}

export default Blob;
