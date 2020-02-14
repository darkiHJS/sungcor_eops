import React, { useState, useEffect } from 'react'
import { useParams, useHistory } from 'react-router-dom'
import { Form, message, Upload, Button } from 'antd'
import _ from 'lodash'
import {
  FormBuilder,
  singleRowText,
  multiRowText,
  multiSel,
  singleSel,
  dateTime,
  resource,
  listSel
} from './components'
import { queryOrderModel, createOrder, updateImage } from '../../common/request'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import * as actions from './redux/actions'
import { HeaderBar } from '../common'
import orderConfig from './mock/orderConfig'

import './Form.less'

function pickProps(source, props) {
  const target = {};
  props.forEach(prop => {
    if (prop in source) target[prop] = source[prop];
  });
  return target;
}
const objToFields = (obj) => {
  let target = {}
  for (let [key, value] of Object.entries(obj)) {
    target[key] = Form.createFormField({ value })
  }
  return target
}
const fieldsToObj = (fields) => {
  let target = {}
  for (let [key, field] of Object.entries(fields)) {
    if (field.value !== void 0) {
      target[key] = field.value
    }
  }
  return target
}
const cr = {
  "singleRowText": singleRowText,
  "singleSel": singleSel,
  "listSel": listSel,
  "multiRowText": multiRowText,
  "resource": resource,
  "attachfile": singleRowText,
  "department": singleRowText,
  "dateTime": dateTime,
  "multiSel": multiSel,
  "cascader": singleRowText,
  "treeSel": singleRowText,
  "double": singleRowText
}
const MESSAGE_KEY = 'messageKey'
const CreateOrder = Form.create({
  onFieldsChange: (props, changeFields, allFields) => {
    props.actions.setForm(fieldsToObj(allFields))
  },
  mapPropsToFields(props) {
    return objToFields(props.order.form)
  }
})((props) => {
  // console.log(props)
  const { modal } = useParams()
  const history = useHistory()
  const [orderModal, setOrderModal] = useState({})
  const [meta, setMeta] = useState([])
  const [needFile, setNeedFile] = useState(false)

  const [files, setFiles] = useState([]) //图片
  
  useEffect(() => { 
    if(files.length) {
      let file = files[0]
      let reader = new FileReader()
      reader.readAsDataURL(file)
      console.log(file) 
    }
  }, [files])
  useEffect(() => {
    // 加载工单模板
    queryOrderModel({ modelId: modal }).then(d => {
      console.log(d)
      setOrderModal(d)
    }).catch(e => {
      message.error('从远程加载模板失败' + e)
    })
  }, [modal])

  useEffect(() => {
    // 给formBuilder提供meta
    let newMeta = []
    if (orderModal.hasOwnProperty('field_list')) {
      let orderRule = _.get(orderConfig, `${modal}.${orderModal.name}`, {})
      orderModal.field_list.forEach(field => {
        if (field.code === 'file') {
          setNeedFile(true)
          return
        }
        if (orderRule.hidden && orderRule.hidden.includes(field.code)) {
          return
        }
        const element = pickProps(field, [
          'code', 'name', 'id', 'type', 'params', 'cascader', 'type_desc'
        ])
        element.widget = cr[element.type]
        element.form = props.order.form
        element.rules = []
        if (orderRule.readOnly && orderRule.readOnly.indexOf(field.code) !== -1) {
          element.disabled = true
        }
        if (orderRule.required && orderRule.required.includes(field.code)) {
          element.rules.push({
            required: true,
            message: '必填项'
          })
        }
        newMeta.push(element)
      })
      setMeta(newMeta)
    }
  }, [orderModal, props.order, modal])
  useEffect(() => {
    let orderRule = _.get(orderConfig, `${modal}.${orderModal.name}`, {})
    if (orderRule && orderRule.hasOwnProperty('defaultValue')) {
      let defaultForm = {}
      for (const [key, value] of Object.entries(orderRule.defaultValue)) {
        if (props.user.userAccountInfo.hasOwnProperty(value)) {
          defaultForm[key] = props.user.userAccountInfo[value]
        } else {
          defaultForm[key] = value
        }
      }
      props.actions.setForm(defaultForm)
    }
  }, [props.actions, props.user, orderModal, modal])
  return (
    <div className='order-page-form'>
      <HeaderBar title='工单创建' />
      <div className='form'>
        <Form>
          <FormBuilder meta={meta} form={props.form} />
        </Form>
        {needFile ?
          <div>
            <h4>上传图片附件</h4>
            <Upload
              listType="picture-card"
              fileList={files}
              onRemove={file => {
                const index = files.indexOf(file);
                setFiles(oldFiles => [...oldFiles.splice(index, 1)])
              }}
              beforeUpload={file => {
                setFiles(oldFiles => [...oldFiles, file])
                return false
              }}>
              上传图片
            </Upload>
          </div> : null}

        <Button
          type="primary"
          style={{ backgroundColor: '#005da3' }}
          block
          onClick={() => {
            let pass = true
            props.form.validateFieldsAndScroll((err, value) => {
              if (err) {
                pass = false
              }
            })
            if (!pass) {
              message.warning('请填写完全工单信息！')
              return
            }
            message.loading({content:'创建工单中……', key:MESSAGE_KEY})
            createOrder({
              model_id: modal,
              ticket_source: "wchart",
              urgent_level: 2,
              title: props.order.form.title,
              description: "",
              form: {
                ...props.order.form
              },
              handle_rules: {
                route_id: orderModal.handle_rules[0].route_id
              }
            }).then(da => {
              message.success({content:'创建成功', key:MESSAGE_KEY})
              if(files.length) {
                message.loading({content:'开始上传图片……', key:MESSAGE_KEY})
                files.map((i) => {
                  let reader = new FileReader();
                  reader.readAsDataURL(i)
                  reader.onload = e => {
                    let imgBase64 = e.target.result
                    updateImage({
                      ticketId: da.data.id,
                      filesBase64: [imgBase64.split(',')[1]]
                    }).then(() => {
                      message.success({content:'上传成功', key:MESSAGE_KEY})
                    })
                  }
                })  
              
                history.push('/order')
              }else {
                history.push('/order')
              }
            })
          }}>提交</Button>
      </div>
    </div>
  )
})



function mapStateToProps(state) {
  return {
    user: state.user,
    order: state.order
  }
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators({ ...actions }, dispatch),
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(CreateOrder)