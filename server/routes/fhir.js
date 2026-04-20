const express = require('express');
const router = express.Router();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const FHIR_BASE_URL = 'https://hapi.fhir.org/baseR4';
const USERS_FILE = path.join(__dirname, '../data/users.json');

/**
 * 初始化或獲取病患 (Patient)
 * 如果 HAPI 上不存在，則創建一個
 */
router.post('/patient/sync', async (req, res) => {
    const { id, name } = req.body;
    
    try {
        // 嘗試搜索是否已有該 Identifier 的 Patient
        const searchRes = await axios.get(`${FHIR_BASE_URL}/Patient`, {
            params: { identifier: `healscape-user-${id}` }
        });

        if (searchRes.data.total > 0) {
            return res.json({
                success: true,
                fhirId: searchRes.data.entry[0].resource.id,
                data: searchRes.data.entry[0].resource
            });
        }

        // 不存在則創建
        const patientResource = {
            resourceType: "Patient",
            identifier: [{ system: "http://healscape.io/ids", value: `healscape-user-${id}` }],
            name: [{ text: name }],
            active: true
        };

        const createRes = await axios.post(`${FHIR_BASE_URL}/Patient`, patientResource);
        res.json({
            success: true,
            fhirId: createRes.data.id,
            data: createRes.data
        });
    } catch (error) {
        console.error('FHIR Patient Sync Error:', error.response?.data || error.message);
        res.status(500).json({ message: 'FHIR 病患同步失敗', error: error.message });
    }
});

/**
 * 上傳復健數據 (Observation)
 * 接收格式: { patientId, type, value, unit, fhirPatientId }
 */
router.post('/upload', async (req, res) => {
    const { patientId, type, value, unit, fhirPatientId, reps } = req.body;
    
    // 同步更新本地 users.json 確保醫師端列表即時看到最新血壓
    if (type === 'bp') {
        try {
            const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
            const uIdx = users.findIndex(u => u.id === patientId);
            if (uIdx !== -1) {
                users[uIdx].bp = `${value}/${reps || 80}`;
                fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
            }
        } catch (e) { console.error("Update users.json bp failed", e); }
    }

    // 構建 FHIR Observation Resource
    let loincCode = 'LP248386-6';
    let display = 'Grip strength';

    if (type === 'rom') {
        loincCode = '82313-8';
        display = 'Range of motion';
    } else if (type === 'bp') {
        loincCode = '85354-9';
        display = 'Blood Pressure';
    }

    const observation = {
        resourceType: "Observation",
        status: "final",
        category: [
            {
                coding: [
                    {
                        system: "http://terminology.hl7.org/CodeSystem/observation-category",
                        code: "therapy",
                        display: "Therapy"
                    }
                ]
            }
        ],
        code: {
            coding: [
                {
                    system: "http://loinc.org",
                    code: loincCode,
                    display: display
                }
            ],
            text: type
        },
        subject: {
            reference: fhirPatientId ? `Patient/${fhirPatientId}` : `Patient?identifier=healscape-user-${patientId}`
        },
        effectiveDateTime: new Date().toISOString()
    };

    if (type === 'bp') {
        // 使用標準 FHIR BP 結構
        observation.component = [
            {
                code: { coding: [{ system: "http://loinc.org", code: "8480-6", display: "Systolic blood pressure" }] },
                valueQuantity: { value: parseFloat(value), unit: "mmHg", system: "http://unitsofmeasure.org", code: "mm[Hg]" }
            },
            {
                code: { coding: [{ system: "http://loinc.org", code: "8462-4", display: "Diastolic blood pressure" }] },
                valueQuantity: { value: parseFloat(reps || 80), unit: "mmHg", system: "http://unitsofmeasure.org", code: "mm[Hg]" }
            }
        ];
    } else {
        observation.valueQuantity = {
            value: parseFloat(value),
            unit: unit,
            system: "http://unitsofmeasure.org",
            code: unit === 'deg' ? 'deg' : (unit === 'mmHg' ? 'mm[Hg]' : 'kg')
        };
    }

    try {
        const response = await axios.post(`${FHIR_BASE_URL}/Observation`, observation);
        res.json({
            success: true,
            fhirId: response.data.id,
            data: response.data
        });
    } catch (error) {
        console.error('FHIR Observation Upload Error:', error.response?.data || error.message);
        res.status(500).json({ message: 'FHIR 數據上傳失敗', error: error.message });
    }
});

/**
 * 獲取病患歷史數據
 */
router.get('/history/:patientId', async (req, res) => {
    const { patientId } = req.params;
    const { fhirPatientId } = req.query;
    
    try {
        let params = {
            _sort: '-date',
            _count: 50
        };

        // 如果有 HAPI 內部的 fhirPatientId，直接用 subject
        // 如果沒有，則使用 patient.identifier 搜尋
        if (fhirPatientId) {
            params['subject'] = `Patient/${fhirPatientId}`;
        } else {
            params['patient.identifier'] = `http://healscape.io/ids|healscape-user-${patientId}`;
        }
        
        const response = await axios.get(`${FHIR_BASE_URL}/Observation`, { params });

        const entries = response.data.entry || [];
        const history = entries.map(item => {
            const resource = item.resource;
            const type = resource.code?.text || (resource.code?.coding ? resource.code.coding[0].display : 'unknown');
            let value = resource.valueQuantity?.value || 0;
            let reps = 0;

            // 如果是血壓類型且有 component (標準 FHIR BP)
            if (resource.component && resource.component.length >= 2) {
                value = resource.component[0].valueQuantity?.value || 0;
                reps = resource.component[1].valueQuantity?.value || 0;
            }

            return {
                date: resource.effectiveDateTime ? resource.effectiveDateTime.split('T')[0] : 'N/A',
                type: type,
                value: value,
                reps: reps,
                unit: resource.valueQuantity?.unit || (resource.component ? resource.component[0].valueQuantity?.unit : ''),
                fhirId: resource.id
            };
        });

        res.json({ success: true, history });
    } catch (error) {
        // 如果是 HAPI 回傳錯誤 (如 400/404)，我們視為「尚無數據」，回傳空陣列而非 500
        console.warn(`FHIR Fetch Warning for ${patientId}:`, error.message);
        res.json({ success: true, history: [], message: '目前尚無 FHIR 存證數據' });
    }
});

module.exports = router;
