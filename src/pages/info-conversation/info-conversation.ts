import { Component, NgZone } from '@angular/core';
import { AlertController, Events, LoadingController} from 'ionic-angular';
import { TranslateService } from '@ngx-translate/core';

// models
import { UserModel } from '../../models/user';
import { GroupModel } from '../../models/group';

// services
import { UploadService } from '../../providers/upload-service/upload-service';
import { UserService } from '../../providers/user/user';
import { GroupService } from '../../providers/group/group';
import { ChatManager } from '../../providers/chat-manager/chat-manager';
import { ChatPresenceHandler } from '../../providers/chat-presence-handler';

// utils
import { URL_TICKET_CHAT, URL_SEND_BY_EMAIL, URL_VIDEO_CHAT, TYPE_SUPPORT_GROUP, TYPE_GROUP, SYSTEM, URL_NO_IMAGE, LABEL_NOICON } from '../../utils/constants';
import { getFormatData, createConfirm, urlify, isExistInArray, createLoading } from '../../utils/utils';
import { PlaceholderPage } from '../placeholder/placeholder';
import { ChatConversationsHandler } from '../../providers/chat-conversations-handler';
import { TiledeskConversationProvider } from '../../providers/tiledesk-conversation/tiledesk-conversation';
import { ConversationModel } from '../../models/conversation';

import { NavProxyService } from '../../providers/nav-proxy';


@Component({
  selector: 'page-info-conversation',
  templateUrl: 'info-conversation.html',
})
export class InfoConversationPage {

  public uidSelected: string;
  public channel_type: string;
  public userDetail: UserModel;
  public groupDetail: GroupModel;
  public members: UserModel[];
  public currentUserDetail: UserModel;
  public profileYourself: boolean;
  public attributes: any = {};
  private customAttributes = []; 
  public attributesClient: string = '';
  public attributesSourcePage: string = '';
  public attributesDepartments: string = '';
  public online: boolean;
  public lastConnectionDate: string;
  public conversationEnabled: boolean;

  public TYPE_GROUP = TYPE_GROUP;
  public URL_SEND_BY_EMAIL = URL_SEND_BY_EMAIL;
  public URL_VIDEO_CHAT = URL_VIDEO_CHAT;

  private loadingDialog : any;
  private confirmDialog : any;

  private isLoggedUserGroupMember : boolean;

  arrayUsersStatus = [];

  constructor(
    public events: Events,
    public chatManager: ChatManager,
    public userService: UserService,
    public groupService: GroupService,
    public upSvc: UploadService,
    public zone: NgZone,
    private conversationsHandler : ChatConversationsHandler,
    private tiledeskConversationProvider : TiledeskConversationProvider,
    public alertCtrl: AlertController,
    public translate: TranslateService,
    private loadingCtrl: LoadingController,
    private navProxy: NavProxyService,
    public chatPresenceHandler: ChatPresenceHandler
  ) {
    this.profileYourself = false;
    this.online = false; 
    this.isLoggedUserGroupMember = false;
    this.events.subscribe('closeDetailConversation', this.closeDetailConversation);
  }

  ngOnInit() {
    console.log('InfoConversationPage::ngOnInit');
    this.initialize();
  }

  ionViewWillLeave() {
    console.log('------------> ionViewWillLeave');
    this.unsubescribeAll();
  }

  // /**
  //  * quando esco dalla pagina distruggo i subscribe
  //  */
  // ionViewWillLeave() {
  //   // nn passa mai di qui!!!!
  //   console.log('InfoConversationPage ionViewWillLeave');
  //   //this.unsubscribeInfoConversation();

  // }


  initialize(){
    console.log('InfoConversationPage::initialize');
    this.arrayUsersStatus = [];
    this.profileYourself = false;
    this.currentUserDetail = this.chatManager.getLoggedUser();
    this.userDetail = new UserModel('', '', '', '', '', '');
    this.groupDetail = new GroupModel('', 0, '', [], '', '');
    this.setSubscriptions();
  }

  //// SUBSCRIBTIONS ////
  /** 
   * subscriptions list 
  */
 initSubscriptions(uid){
  console.log('initSubscriptions.', uid);
  //this.arrayUsersStatus['7CzGOPMbDrXq3Im7APVq5K3advl2'] = true; 
  // subscribe stato utente con cui si conversa ONLINE
  this.events.subscribe('statusUser:online-'+uid, this.statusUserOnline);
  // subscribe stato utente con cui si conversa ONLINE
  this.events.subscribe('statusUser:offline-'+uid, this.statusUserOffline);
}

  /**
   * on subscribe stato utente con cui si conversa ONLINE
   */
  statusUserOnline: any = (uid) => {
    //if(uid !== this.conversationWith){return;}
    this.arrayUsersStatus[uid] = true;
    console.log('************** ONLINE',this.arrayUsersStatus);
  }
  /**
   * on subscribe stato utente con cui si conversa OFFLINE
   */
  statusUserOffline: any = (uid) => {
    this.arrayUsersStatus[uid] = false;
    console.log('************** OFFLINE', this.arrayUsersStatus);
  }
  //// UNSUBSCRIPTIONS ////
  /**
   * unsubscribe all subscribe events
   */
  unsubescribeAll(){
    this.arrayUsersStatus.forEach((value, key) => {
      console.log("unsubscribe key", key)
      this.events.unsubscribe('statusUser:online-'+key, null);
      this.events.unsubscribe('statusUser:offline-'+key, null);
    });
    
  }


  /** SUBSCRIPTIONS */
  setSubscriptions(){
    console.log('InfoConversationPage::setSubscriptions');
    this.events.subscribe('onOpenInfoConversation', this.subcribeOnOpenInfoConversation);
    this.events.subscribe('changeStatusUserSelected', this.subcribeChangeStatusUserSelected);
    // this.events.subscribe('loadUserDetail:complete', this.subcribeLoadUserDetail);
    // this.events.subscribe('loadGroupDetail:complete', this.subcribeLoadGroupDetail);
    this.events.subscribe('PopupConfirmation', this.subcribePopupConfirmation);
  }

  /**  */
  subcribePopupConfirmation: any = (resp, action) => {
    
    var LABEL_ANNULLA = this.translate.get('CLOSE_ALERT_CANCEL_LABEL')['value'];
    if(resp === LABEL_ANNULLA) { return; }

    var that = this;

    if(action === 'leave') {
      // // dismiss the confirm dialog
      // this.dismissConfirmDialog();

      // create and show loading dialog
      var spinnerMessage;
      this.translate.get('LEAVING_GROUP_SPINNER_MSG').subscribe(
        value => {
          spinnerMessage = value;
        }
      )
      this.createLoadingDialog(spinnerMessage);

      this.leaveGroup(function callback(result) {
        if (result == 'success') {
          // dismiss the loading dialog
          that.dismissLoadingDialog();
          that.openPopupConfirmation('group-left');
        } else if (result == 'error') {
          // dismiss the loading dialog
          that.dismissLoadingDialog();
          that.openPopupConfirmation('cannot-leave-group');
        }
      });
    } else if (action === 'close') {
      this.closeConversation(this.uidSelected);
    }
  }

  /** */
  subcribeOnOpenInfoConversation: any = (openInfoConversation, uidUserSelected, channel_type, attributes)  => {
    console.log('InfoConversationPage::subcribeOnOpenInfoConversation');

    // se openInfoConversation === false il pannello è chiuso!
    if(!openInfoConversation){ return; } 
    this.uidSelected = uidUserSelected;
    this.channel_type = channel_type;
    this.attributes = attributes;

    this.updateAttributes(this.attributes);
    
    this.populateDetail();
  };

  private updateAttributes(attributes) {
    console.log('InfoConversationPage::updateAttributes');

    if (attributes) {

      // console.log("InfoConversationPage::subcribeOnOpenInfoConversation::attributes", attributes)

      this.attributesClient = (attributes.client) ? attributes.client : '';
      this.attributesSourcePage = (attributes.sourcePage) ? urlify(attributes.sourcePage) : '';
      //this.attributesDepartments = (attributes.departments)?this.arrayDepartments(attributes.departments).join(", "):'';

      this.createCustomAttributesMap(attributes);
      // console.log("InfoConversationPage::subcribeOnOpenInfoConversation::attributes", attributes);
      // console.log("InfoConversationPage::subcribeOnOpenInfoConversation::customAttributes", this.customAttributes);
    }
  }

  // create a new attributes map without 'client', 'departmentId', 'departmentName', 'sourcePage', 'userEmail', 'userFullname'
  private createCustomAttributesMap(attributes) {
    var tempMap = []; 

    // perform a deep copy of the attributes item.
    // it prevents the privacy leak issue
    var temp = JSON.parse(JSON.stringify(attributes));
    // remove 'client'
    if (temp && temp['client']) delete temp['client'];
    // remove 'departmentId'
    if (temp && temp['departmentId']) delete temp['departmentId'];
    // remove 'departmentName'
    if (temp && temp['departmentName']) delete temp['departmentName'];
    // remove 'sourcePage'
    if (temp && temp['sourcePage']) delete temp['sourcePage'];
    // remove 'userEmail'
    if (temp && temp['userEmail']) delete temp['userEmail'];
    // remove 'userFullname'
    if (temp && temp['userFullname']) delete temp['userFullname'];

    // add the remaining keys to the customAttributes array
    for (var key in temp) {
      if (temp.hasOwnProperty(key)) {
        var val = temp[key];

        // create the array item
        var item = {
          "key": key, 
          "value" : val
        }

        // add the item to the custom attributes array
        tempMap.push(item);
      }
    }

    this.customAttributes = tempMap;
  }

  /** */
  subcribeChangeStatusUserSelected: any = (lastConnectionDate, online) => {
    this.online = online;
    this.lastConnectionDate = lastConnectionDate;
  };


  /**
   * unsubscribe all subscribe events
   */
  closeDetailConversation: any = e => {
    // console.log('UNSUBSCRIBE -> unsubescribeAll', this.events);
    this.events.unsubscribe('onOpenInfoConversation', null);
    this.events.unsubscribe('changeStatusUserSelected', null);
    // this.events.unsubscribe('loadUserDetail:complete', null);
    // this.events.unsubscribe('loadGroupDetail:complete', null);
    this.events.unsubscribe('PopupConfirmation', null);

    this.events.unsubscribe(this.uidSelected + '-details', null);
    this.events.unsubscribe(this.uidSelected + '-listener', null);
  }
  // ----------------------------------------- //


  /** selectUserDetail
   * se uid conversazione esiste popolo:
   * 1 - dettaglio current user
   * 2 - dettaglio gruppo
   * 3 - dettaglio user
  */
  populateDetail(){
    console.log('InfoConversationPage::populateDetail');

    // debugger;
    const that = this;
    if(!this.uidSelected){
      return;
    } else if(this.uidSelected === this.currentUserDetail.uid){
      this.profileYourself = true;
      this.userDetail = this.currentUserDetail;
    } else if(this.channel_type === TYPE_GROUP) {
      this.profileYourself = false;
      this.members = [];
      // //this.groupDetail = new GroupModel(this.uidSelected, 0, '', [], '', '');
      // this.groupService.loadGroupDetail(this.currentUserDetail.uid, this.uidSelected)
      // .then(function(snapshot) { 
      //   //this.groupDetail = new GroupModel(snapshot.key, 0, '', [], '', '');        
      //   if (snapshot.val()){
      //     that.setDetailGroup(snapshot);
      //   }
      // })
      // .catch(function(err) {
      //   console.log('Unable to get permission to notify.', err);
      // });

      // init conversation subscription (close btn)
      this.events.subscribe(this.uidSelected + '-listener', this.subscribeConversationListener);
      this.conversationsHandler.addConversationListener(this.currentUserDetail.uid, this.uidSelected);
      
      // init group details subscription
      this.events.subscribe(this.uidSelected + '-details', this.subscribeGroupDetails);
      this.groupService.loadGroupDetail(this.currentUserDetail.uid, this.uidSelected);

    } else {
      this.profileYourself = false;
      //this.userDetail = new UserModel(this.uidSelected, '', '', '', '', '');
      this.userService.loadUserDetail(this.uidSelected)
      .then(function(snapshot) { 
        // console.log('snapshot:: ', snapshot.val());
        if (snapshot.val()){
          that.setDetailUser(snapshot);
        }
      })
      .catch(function(err) {
        console.error('Unable to get permission to notify.', err);
      });
    } 
  }

  // subscriptio on conversation changes
  subscribeConversationListener: any = (snapshot) => {
    console.log('InfoConversationPage::subscribeConversationListener');

    var that = this;

    console.log("InfoConversationPage::subscribeConversationListener::snapshot:", snapshot.ref.toString());

    if (snapshot.val()) {
      console.log("InfoConversationPage::subscribeConversationListener::snapshotVal:", snapshot.val())
      // conversation exists within conversation list
      that.conversationEnabled = true;
    } else {
      // conversation not exists within conversation list
      that.conversationEnabled = false;
    }

    console.log("InfoConversationPage::subscribeConversationListener::conversationEnabled:", this.conversationEnabled);

  }

  // subscriptiuo on group changes
  subscribeGroupDetails: any = (snapshot) => {
    console.log('InfoConversationPage::subscribeGroupDetails');

    var that = this;  
    
    // console.log("InfoConversationPage::subscribeGroupDetails::snapshot:", snapshot.val())

    if (snapshot.val()){
      if (snapshot.val().attributes) {
        // update the local attributes variable
        that.attributes = snapshot.val().attributes; 
        that.updateAttributes(snapshot.val().attributes);
      }
      // render layout
      that.setDetailGroup(snapshot);
    }
  }


  setDetailUser(snapshot){
    //let userDetail = new UserModel(snapshot.key, '', '', snapshot.key, '', '');        
    const user = snapshot.val();
    const fullname = user.firstname+" "+user.lastname;  
    this.userDetail = new UserModel(
      snapshot.key, 
      user.email, 
      user.firstname, 
      user.lastname, 
      fullname.trim(), 
      user.imageurl
    );        
  }


  setDetailGroup(snapshot){
    console.log("InfoConversationPage::setDetailGroup::snapshot", snapshot.val());

    const group = snapshot.val();
    this.groupDetail = new GroupModel(
      snapshot.key, 
      getFormatData(group.createdOn), 
      group.iconURL,
      this.groupService.getUidMembers(group.members), 
      group.name, 
      group.owner
    );    
    if(!this.groupDetail.iconURL || this.groupDetail.iconURL === LABEL_NOICON){
      this.groupDetail.iconURL = URL_NO_IMAGE;
    }
    this.members = this.getListMembers(this.groupDetail.members);
    // console.log(this.groupDetail.members.length);
    // console.log("InfoConversationPage::setDetailGroup::members", this.members);


    // console.log("setDetailGroup.groupDetail.members", this.groupDetail.members);
    // console.log("setDetailGroup.groupDetail.members.length", this.members.length);

    if (!isExistInArray(this.groupDetail.members, this.currentUserDetail.uid) || this.groupDetail.members.length <= 1 ){
      this.isLoggedUserGroupMember = false;
    } else {
      this.isLoggedUserGroupMember = true;
    }

    // debugger
  }



  /** */
  getListMembers(members): UserModel[]{ 
    // console.log("InfoConversationPage::getListMembers::members", members);
    let arrayMembers = [];
    // var membersSize = 0;
    let that = this;
    members.forEach(member => {
      // console.log("InfoConversationPage::getListMembers::member", member);
      let userDetail = new UserModel(member, '', '', member, '', URL_NO_IMAGE);
      if (member.trim() !== '' && member.trim() !== SYSTEM) {
        this.userService.getUserDetail(member)
        .then(function(snapshot) { 
          // console.log("InfoConversationPage::getListMembers::snapshot", snapshot);
          if (snapshot.val()){
            const user = snapshot.val();
            const fullname = user.firstname+" "+user.lastname;  
            let imageUrl =  URL_NO_IMAGE;
            if(user.imageurl && user.imageurl !== LABEL_NOICON){
              imageUrl = user.imageurl;
            }
            userDetail = new UserModel(
              snapshot.key, 
              user.email, 
              user.firstname, 
              user.lastname, 
              fullname.trim(), 
              imageUrl
            );  
            // console.log("InfoConversationPage::getListMembers::userDetail", userDetail);
          }
          // console.log("---------------> : ", member);
          arrayMembers.push(userDetail);
          // membersSize++;

          that.initSubscriptions(userDetail.uid);
          that.chatPresenceHandler.userIsOnline(userDetail.uid);
          
        })
        .catch(function(err) {
          console.error('Unable to get permission to notify.', err);
        });
      }
    });

    // arrayMembers.length = membersSize; // fix the array size
    // console.log("InfoConversationPage::getListMembers::arrayMembers", arrayMembers);
    return arrayMembers;
  }

  /** */
  arrayDepartments(departments): any[] {
    // console.log('departments:::: ', departments);
    let arrayDepartments = [];
    const departmentsStr = JSON.stringify(departments);
    JSON.parse(departmentsStr, (key, value) => {
      arrayDepartments.push(value);
    });
    return arrayDepartments.slice(0, -1);
  }




  //// ACTIONS ////
  /** */
  leaveGroup(callback){
    // var spinnerMessage;
    // this.translate.get('LEAVING_GROUP_SPINNER_MSG').subscribe(
    //   value => {
    //     spinnerMessage = value;
    //   }
    // );

    // this.loadingDialog = createLoading(this.loadingCtrl, spinnerMessage);
    // this.loadingDialog.present();

    const uidUser = this.chatManager.getLoggedUser().uid; //'U4HL3GWjBsd8zLX4Vva0s7W2FN92';
    const uidGroup = this.uidSelected;//'support-group-L5Kb42X1MaM71fGgL66';
    this.groupService.leaveAGroup(uidGroup, uidUser)
    .subscribe(
      response => {
        // console.log('leaveGroup OK sender ::::', response);
        this.dismissLoadingDialog();
        callback('success');
      },
      errMsg => {
        this.dismissLoadingDialog();
        console.log('leaveGroup ERROR MESSAGE', errMsg);
        callback('error');
      },
      () => {
        // console.log('leaveGroup API ERROR NESSUNO');
      }
    );
  }

  /** */
  closeGroup(callback) {
    const uidGroup = this.uidSelected;//'support-group-L5Kb42X1MaM71fGgL66';
    var that = this;
    this.groupService.closeGroup(uidGroup, function(response, error) {
      if (error) {
        console.error('closeGroup ERROR MESSAGE', error);
        callback('error', error);
      }
      else {
        callback('success', response);
      }
    });
    // this.groupService.closeGroup(uidGroup)
    // .subscribe(
    //   response => {
    //     // console.log('OK closeGroup ::::', response);
    //     // this.loading.dismiss();
    //     // this.dismissLoading();
    //     callback('success');
    //   },
    //   errMsg => {
    //     // this.dismissLoading();
    //     console.error('closeGroup ERROR MESSAGE', errMsg);
    //     // this.loading.dismiss();
    //     callback('error');
    //   },
    //   () => {
    //     // console.log('closeGroup API ERROR NESSUNO');
    //   }
    // );
  }

  /** */
  setVideoChat(){
    // setto url 
    const url = this.URL_VIDEO_CHAT+'?groupId='+this.groupDetail.uid+'&popup=true';
    this.events.publish('openVideoChat', url);
  }

  getUrlCreaTicket(){
    // setto url 
    return URL_TICKET_CHAT;
    //const url = URL_TICKET_CHAT + '&popup=true';
    //this.events.publish('openVideoChat', url);
  }


  /**
   * 
   * @param action 
   */
  openPopupConfirmation(action){
    // console.log("openPopupConfirmation");

    //debugger;
    let alertTitle = '';
    let alertMessage = '';
    this.translate.get('ALERT_TITLE').subscribe(
      value => {
        alertTitle = value;
      }
    )

    var onlyOkButton = false;

    if(action === 'leave'){
      this.translate.get('LEAVE_ALERT_MSG').subscribe(
        value => {
          alertMessage = value;
        }
      )
      onlyOkButton = false;
    } else if (action === 'group-left') {
      this.translate.get('CONVERSATION_LEFT_ALERT_MSG').subscribe(
        value => {
          alertMessage = value;
        }
      )
      onlyOkButton = true;
    } else if (action === 'cannot-leave-group') {
      this.translate.get('CANNOT_LEAVE_GROUP_ALERT_MSG').subscribe(
        value => {
          alertMessage = value;
        }
      )
      onlyOkButton = false;
    } else if (action === 'close') {
      this.translate.get('CLOSE_ALERT_MSG').subscribe(
        value => {
          alertMessage = value;
        }
      )
      onlyOkButton = false;
    }

    // console.log("onlyOkButton", onlyOkButton);

    this.confirmDialog = createConfirm(this.translate, this.alertCtrl, this.events, alertTitle, alertMessage, action, onlyOkButton);
    this.confirmDialog.present();
  }

  /** */
  isSupportGroup(){
    //debugger;
    return this.groupService.isSupportGroup(this.groupDetail.uid);
    // let uid = this.groupDetail.uid;
    // if(uid.indexOf(TYPE_SUPPORT_GROUP) === 0 ){
    //   return true;
    // }
    // return false;
  }

  private createLoadingDialog(message) {
    this.loadingDialog = createLoading(this.loadingCtrl, message);
    this.loadingDialog.present();
  }

  private dismissLoadingDialog() {
    if (this.loadingDialog) {
      this.loadingDialog.dismiss();
      this.loadingDialog = null;
    }
  }

  private dismissConfirmDialog() {
    if (this.confirmDialog) {
      this.confirmDialog.dismiss();
      this.confirmDialog = null;
    }
  }

  private closeConversation(conversationId) {
    // console.log("InfoConversationPage::closeConversation::conversationId", conversationId);

    var isSupportConversation = conversationId.startsWith("support-group");

    if (!isSupportConversation) {
      // console.log("InfoConversationPage::closeConversation:: is not a support group");

      this.deleteConversation(conversationId, function (result, data) {
        if (result === 'success') {
          // console.log("InfoConversationPage::closeConversation::deleteConversation::response", data);
        } else if (result === 'error') {
          console.log("InfoConversationPage::closeConversation::deleteConversation::error", data);
        }
      });

      // https://github.com/chat21/chat21-cloud-functions/blob/master/docs/api.md#delete-a-conversation
    } else {
      // console.log("InfoConversationPage::closeConversation::closeConversation:: is a support group");

      // the conversationId is:
      // - the recipientId if it is a direct conversation;
      // - the groupId if it is a group conversation;
      // the groupId can reference:
      // - a normal group;
      // - a support  group if it starts with "support-group"
      this.closeSupportGroup(conversationId, function (result, data) {
        if (result === 'success') {
          // console.log("InfoConversationPage::closeConversation::closeSupportGroup::response", data);
        } else if (result === 'error') {
          console.log("InfoConversationPage::closeConversation::closeSupportGroup::error", data);
        }
      });
    }
  }

  // close the support group
  // more details availables at 
  // https://github.com/chat21/chat21-cloud-functions/blob/master/docs/api.md#close-support-group
  private closeSupportGroup(groupId, callback) {

    var that = this;

    // BEGIN -  REMOVE FROM LOCAL MEMORY 
    // console.log("performClosingConversation::conversations::BEFORE", JSON.stringify(this.conversationsHandler.conversations) )
    this.conversationsHandler.removeByUid(groupId); // remove the item 
    // this.conversations = this.conversationsHandler.conversations; // update conversations
    // console.log("performClosingConversation::conversations::AFTER", JSON.stringify(this.conversationsHandler.conversations))
    // END -  REMOVE FROM LOCAL MEMORY 

    // BEGIN - REMOVE FROM REMOTE 
    //set the conversation from the isConversationClosingMap that is waiting to be closed
    this.tiledeskConversationProvider.setClosingConversation(groupId, true);

    this.groupService.closeGroup(groupId, function(response, error) {
      if (error) {
        // the conversation closing failed: restore the conversation with 
        // conversationId status to false within the isConversationClosingMap
        that.tiledeskConversationProvider.setClosingConversation(groupId, false);
        callback('error', error);
      }
      else {
        callback('success', response);
      }
    });

    // this.groupService.closeGroup(groupId)
    //   .subscribe(response => {
    //     callback('success', response);
    //   }, errMsg => {
    //     // the conversation closing failed: restore the conversation with 
    //     // conversationId status to false within the isConversationClosingMap
    //     that.tiledeskConversationProvider.setClosingConversation(groupId, false);

    //     callback('error', errMsg);
    //   }, () => {
    //     // console.log("InfoConversationPage::closeSupportGroup::completition");
    //   });
    // // END - REMOVE FROM REMOTE 

    // when a conversations is closed shows a placeholder background
    if (groupId === that.uidSelected) {
      that.navProxy.pushDetail(PlaceholderPage, {});
    }
  }

  // delete a conversation form the personal timeline
  // more details availables at 
  // https://github.com/chat21/chat21-cloud-functions/blob/master/docs/api.md#delete-a-conversation
  private deleteConversation(conversationId, callback) {
    // console.log("InfoConversationPage::deleteConversation::conversationId", conversationId);

    var that = this;

    // END - REMOVE FROM LOCAL MEMORY 
    // console.log("deleteConversation::conversations::BEFORE", JSON.stringify(this.conversationsHandler.conversations))
    this.conversationsHandler.removeByUid(conversationId); // remove the item 
    // this.conversations = this.conversationsHandler.conversations; // update conversations
    // console.log("deleteConversation::conversations::AFTER", JSON.stringify(this.conversationsHandler.conversations))
    // END - REMOVE FROM LOCAL MEMORY 

    // BEGIN - REMOVE FROM REMOTE 
    //set the conversation from the isConversationClosingMap that is waiting to be closed
    this.tiledeskConversationProvider.setClosingConversation(conversationId, true);

    this.tiledeskConversationProvider.deleteConversation(conversationId, function(response, error) {
      if (error) {
        that.tiledeskConversationProvider.setClosingConversation(conversationId, false);
        callback('error', error);
      }
      else {
        callback('success', response);
      }
    });

    // this.tiledeskConversationProvider.deleteConversation(conversationId)
    //   .subscribe(response => {
    //     callback('success', response);
    //   }, errMsg => {
    //     // the conversation closing failed: restore the conversation with
    //     // conversationId status to false within the isConversationClosingMap
    //     that.tiledeskConversationProvider.setClosingConversation(conversationId, false);
    //     callback('error', errMsg);
    //   }, () => {
    //     // console.log("InfoConversationPage::deleteConversation::completition");
    //   });
    // // END - REMOVE FROM REMOTE 

    // when a conversations is closed shows a placeholder background
    if (conversationId === that.uidSelected) {
      that.navProxy.pushDetail(PlaceholderPage, {});
    }
  }

   private existsInArray(array: ConversationModel[], uid) : boolean{
     var index = array.map(function (o) { return o.uid; }).indexOf(uid);

    //  console.log('echouid', uid);
    //  console.log('echoindex', index);

     return index > -1;

    }

    
}
