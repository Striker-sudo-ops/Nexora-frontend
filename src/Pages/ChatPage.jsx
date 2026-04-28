import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import AES from 'crypto-js/aes';
import encUtf8 from 'crypto-js/enc-utf8';

const APP_SECRET = 'chatify-super-secret-key-123';
const encryptMessage = (text, chatId) => {
  if (!text) return text;
  return AES.encrypt(text, chatId + APP_SECRET).toString();
};
const decryptMessage = (ciphertext, chatId) => {
  if (!ciphertext) return ciphertext;
  try {
    const bytes = AES.decrypt(ciphertext, chatId + APP_SECRET);
    const originalText = bytes.toString(encUtf8);
    return originalText || ciphertext;
  } catch (err) {
    return ciphertext;
  }
};

const ENDPOINT = 'http://localhost:5000';
var socket, selectedChatCompare;

const formatTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const ChatPage = () => {
  const [user, setUser] = useState();
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [socketConnected, setSocketConnected] = useState(false);
  const [search, setSearch] = useState('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);

  // Modals state
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isGroupInfoModalOpen, setIsGroupInfoModalOpen] = useState(false);
  const [groupMembersSearch, setGroupMembersSearch] = useState('');
  const [showGroupMembers, setShowGroupMembers] = useState(true);
  const [showAddGroupMember, setShowAddGroupMember] = useState(false);
  const [isUserInfoModalOpen, setIsUserInfoModalOpen] = useState(false);
  const [modalUser, setModalUser] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Chat list menu state
  const [activeChatMenuId, setActiveChatMenuId] = useState(null);

  // Scheduled message state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduledMessageContent, setScheduledMessageContent] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [schedulingChatId, setSchedulingChatId] = useState(null);

  // Self-destruct state
  const [isSelfDestructModalOpen, setIsSelfDestructModalOpen] = useState(false);
  const [selfDestructChatId, setSelfDestructChatId] = useState(null);
  const [selfDestructTimer, setSelfDestructTimer] = useState(null);

  // Summary state
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [summaryContent, setSummaryContent] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);

  // Forward state
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState(null);

  // Smart Replies state
  const [smartReplies, setSmartReplies] = useState([]);
  const [isFetchingReplies, setIsFetchingReplies] = useState(false);

  const handleLogout = () => {
    let accounts = JSON.parse(localStorage.getItem('userAccounts')) || [];
    accounts = accounts.filter(acc => acc._id !== user._id);
    localStorage.setItem('userAccounts', JSON.stringify(accounts));
    if (accounts.length > 0) {
      localStorage.setItem('userInfo', JSON.stringify(accounts[0]));
    } else {
      localStorage.removeItem('userInfo');
    }
    window.location.href = '/';
  };

  // Video call state
  const [videoRoomId, setVideoRoomId] = useState('');

  // Enlarged Image
  const [enlargedImage, setEnlargedImage] = useState(null);
  const [groupPicUploading, setGroupPicUploading] = useState(false);

  // Settings state
  const [baseTheme, setBaseTheme] = useState(localStorage.getItem('baseTheme') || 'dark');
  const [accentColor, setAccentColor] = useState(localStorage.getItem('accentColor') || 'default');
  const [panelPattern, setPanelPattern] = useState(localStorage.getItem('panelPattern') || 'doodles');
  const [enterToSend, setEnterToSend] = useState(JSON.parse(localStorage.getItem('enterToSend') ?? 'true'));

  // Email state
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailSending, setEmailSending] = useState(false);

  // Typing state
  const [typing, setTyping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  // Edit/Delete state
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [dropdownMessageId, setDropdownMessageId] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingToMessage, setReplyingToMessage] = useState(null);

  // Group state
  const [groupChatName, setGroupChatName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);
  const [isRenamingGroup, setIsRenamingGroup] = useState(false);

  // Profile state
  const [profileName, setProfileName] = useState('');
  const [profilePicUrl, setProfilePicUrl] = useState('');
  const [profileUpdating, setProfileUpdating] = useState(false);
  const [picUploading, setPicUploading] = useState(false);

  // Media state
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const messagesEndRef = useRef(null);

  // Accounts Modal State
  const [isAccountsModalOpen, setIsAccountsModalOpen] = useState(false);

  // Unread messages state
  const [unreadCounts, setUnreadCounts] = useState(() => {
    const userInfo = JSON.parse(localStorage.getItem('userInfo'));
    if (userInfo) {
      const saved = localStorage.getItem(`unreadCounts_${userInfo._id}`);
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });

  useEffect(() => {
    const userInfo = JSON.parse(localStorage.getItem('userInfo'));
    if (userInfo) {
      localStorage.setItem(`unreadCounts_${userInfo._id}`, JSON.stringify(unreadCounts));
    }
  }, [unreadCounts]);

  useEffect(() => {
    const closeMenus = (e) => {
      if (e.target.closest('.menu-exclude')) return;
      setIsMenuOpen(false);
      setActiveChatMenuId(null);
      setDropdownMessageId(null);
    };
    document.addEventListener('mousedown', closeMenus);
    return () => {
      document.removeEventListener('mousedown', closeMenus);
    };
  }, []);

  useEffect(() => {
    const userInfo = JSON.parse(localStorage.getItem('userInfo'));
    setUser(userInfo);

    if (!userInfo) {
      window.location.href = '/';
    } else {
      setProfileName(userInfo.name);
      setProfilePicUrl(userInfo.pic);

      socket = io(ENDPOINT);
      socket.emit('setup', userInfo);
      socket.on('connected', () => setSocketConnected(true));

      socket.on('typing', () => setIsTyping(true));
      socket.on('stop typing', () => setIsTyping(false));

      socket.on('message recieved', (newMessageRecieved) => {
        const decryptedMsg = {
          ...newMessageRecieved,
          content: newMessageRecieved.isDeleted ? newMessageRecieved.content : decryptMessage(newMessageRecieved.content, newMessageRecieved.chat._id),
          replyTo: newMessageRecieved.replyTo ? { ...newMessageRecieved.replyTo, content: newMessageRecieved.replyTo.isDeleted ? newMessageRecieved.replyTo.content : decryptMessage(newMessageRecieved.replyTo.content, newMessageRecieved.chat._id) } : null
        };

        if (
          !selectedChatCompare ||
          selectedChatCompare._id !== decryptedMsg.chat._id
        ) {
          // notification logic could go here
          setUnreadCounts(prev => ({
            ...prev,
            [decryptedMsg.chat._id]: (prev[decryptedMsg.chat._id] || 0) + 1
          }));
        } else {
          setMessages((prev) => [...prev, decryptedMsg]);
        }

        setChats(prevChats => {
          const chatIndex = prevChats.findIndex(c => c._id === newMessageRecieved.chat._id);
          if (chatIndex > -1) {
            const updatedChat = { ...prevChats[chatIndex], latestMessage: newMessageRecieved, updatedAt: new Date().toISOString() };
            const newChats = [...prevChats];
            newChats.splice(chatIndex, 1);
            return [updatedChat, ...newChats];
          } else {
            // If the chat wasn't in the list, fetch chats again or add it to the top
            fetchChats(userInfo.token);
            return prevChats;
          }
        });
      });

      socket.on('message edited', (updatedMessage) => {
        const decryptedMsg = {
          ...updatedMessage,
          content: updatedMessage.isDeleted ? updatedMessage.content : decryptMessage(updatedMessage.content, updatedMessage.chat._id),
          replyTo: updatedMessage.replyTo ? { ...updatedMessage.replyTo, content: updatedMessage.replyTo.isDeleted ? updatedMessage.replyTo.content : decryptMessage(updatedMessage.replyTo.content, updatedMessage.chat._id) } : null
        };
        setMessages((prev) => prev.map(m => m._id === decryptedMsg._id ? decryptedMsg : m));
      });

      socket.on('message deleted', (deletedMessage) => {
        const decryptedMsg = {
          ...deletedMessage,
          content: deletedMessage.isDeleted ? deletedMessage.content : decryptMessage(deletedMessage.content, deletedMessage.chat._id),
          replyTo: deletedMessage.replyTo ? { ...deletedMessage.replyTo, content: deletedMessage.replyTo.isDeleted ? deletedMessage.replyTo.content : decryptMessage(deletedMessage.replyTo.content, deletedMessage.chat._id) } : null
        };
        setMessages((prev) => prev.map(m => m._id === decryptedMsg._id ? decryptedMsg : m));
      });

      socket.on('message reacted', (updatedMessage) => {
        const decryptedMsg = {
          ...updatedMessage,
          content: updatedMessage.isDeleted ? updatedMessage.content : decryptMessage(updatedMessage.content, updatedMessage.chat._id),
          replyTo: updatedMessage.replyTo ? { ...updatedMessage.replyTo, content: updatedMessage.replyTo.isDeleted ? updatedMessage.replyTo.content : decryptMessage(updatedMessage.replyTo.content, updatedMessage.chat._id) } : null
        };
        setMessages((prev) => prev.map(m => m._id === decryptedMsg._id ? decryptedMsg : m));
      });

      socket.on('message pinned', (updatedMessage) => {
        const decryptedMsg = {
          ...updatedMessage,
          content: updatedMessage.isDeleted ? updatedMessage.content : decryptMessage(updatedMessage.content, updatedMessage.chat._id),
          replyTo: updatedMessage.replyTo ? { ...updatedMessage.replyTo, content: updatedMessage.replyTo.isDeleted ? updatedMessage.replyTo.content : decryptMessage(updatedMessage.replyTo.content, updatedMessage.chat._id) } : null
        };
        setMessages((prev) => prev.map(m => m._id === decryptedMsg._id ? decryptedMsg : m));
      });



      fetchChats(userInfo.token);

      return () => {
        if (socket) socket.disconnect();
      };
    }
  }, []);

  useEffect(() => {
    document.body.classList.remove('light-theme', 'theme-blue', 'theme-green', 'theme-orange', 'theme-purple', 'theme-red', 'theme-teal', 'theme-monochrome', 'theme-midnight', 'theme-forest', 'theme-sunset');
    
    if (baseTheme === 'light') {
      document.body.classList.add('light-theme');
    }
    
    if (accentColor !== 'default') {
      document.body.classList.add(`theme-${accentColor}`);
    }

    localStorage.setItem('baseTheme', baseTheme);
    localStorage.setItem('accentColor', accentColor);
    localStorage.setItem('panelPattern', panelPattern);
    localStorage.setItem('enterToSend', JSON.stringify(enterToSend));
  }, [baseTheme, accentColor, panelPattern, enterToSend]);

  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat._id);
      selectedChatCompare = selectedChat;
    }
  }, [selectedChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.sender._id !== user?._id && !lastMessage.isDeleted && lastMessage.content && !lastMessage.mediaUrl) {
        fetchSmartReplies(lastMessage.content);
      } else {
        setSmartReplies([]);
      }
    } else {
      setSmartReplies([]);
    }
  }, [messages, user]);

  const fetchSmartReplies = async (content) => {
    if (!content) return;
    try {
      setIsFetchingReplies(true);
      const config = { headers: { Authorization: `Bearer ${user?.token}` } };
      const { data } = await axios.post(`${ENDPOINT}/api/message/smart-replies`, { content }, config);
      setSmartReplies(data.replies || []);
      setIsFetchingReplies(false);
    } catch (error) {
      console.log('Error fetching smart replies');
      setSmartReplies([]);
      setIsFetchingReplies(false);
    }
  };

  const fetchChats = async (token) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const { data } = await axios.get(`${ENDPOINT}/api/chat`, config);
      setChats(data);
    } catch (error) {
      console.log('Error fetching chats');
    }
  };

  const fetchMessages = async (chatId) => {
    if (!chatId) return;
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.get(`${ENDPOINT}/api/message/${chatId}`, config);
      const decryptedData = data.map(m => ({
        ...m,
        content: m.isDeleted ? m.content : decryptMessage(m.content, chatId),
        replyTo: m.replyTo ? { ...m.replyTo, content: m.replyTo.isDeleted ? m.replyTo.content : decryptMessage(m.replyTo.content, chatId) } : null
      }));
      setMessages(decryptedData);
      socket.emit('join chat', chatId);
    } catch (error) {
      console.log('Error fetching messages');
    }
  };

  const typingHandler = (e) => {
    setNewMessage(e.target.value);

    if (!socketConnected) return;

    if (!typing) {
      setTyping(true);
      socket.emit('typing', selectedChat._id);
    }
    let lastTypingTime = new Date().getTime();
    var timerLength = 3000;
    setTimeout(() => {
      var timeNow = new Date().getTime();
      var timeDiff = timeNow - lastTypingTime;
      if (timeDiff >= timerLength && typing) {
        socket.emit('stop typing', selectedChat._id);
        setTyping(false);
      }
    }, timerLength);
  };

  const sendMessage = async (e) => {
    if (e) e.preventDefault();
    if (newMessage.trim()) {
      socket.emit('stop typing', selectedChat._id);
      
      const contentToSend = newMessage;
      const tempId = `temp-${Date.now()}`;
      const tempMsg = {
        _id: tempId,
        sender: user,
        content: contentToSend,
        chat: selectedChat,
        replyTo: replyingToMessage,
        createdAt: new Date().toISOString(),
        status: 'sending'
      };
      
      setMessages(prev => [...prev, tempMsg]);
      setNewMessage('');
      setReplyingToMessage(null);

      try {
        const config = {
          headers: {
            'Content-type': 'application/json',
            Authorization: `Bearer ${user.token}`,
          },
        };
        const { data } = await axios.post(
          `${ENDPOINT}/api/message`,
          {
            content: encryptMessage(contentToSend, selectedChat._id),
            chatId: selectedChat._id,
            replyTo: tempMsg.replyTo?._id || null
          },
          config
        );
        socket.emit('new message', data);
        
        const decryptedData = {
          ...data,
          content: data.isDeleted ? data.content : decryptMessage(data.content, selectedChat._id),
          replyTo: data.replyTo ? { ...data.replyTo, content: data.replyTo.isDeleted ? data.replyTo.content : decryptMessage(data.replyTo.content, selectedChat._id) } : null
        };
        
        setMessages(prev => prev.map(m => m._id === tempId ? { ...decryptedData, status: 'sent' } : m));
        setChats(prevChats => {
          const chatIndex = prevChats.findIndex(c => c._id === selectedChat._id);
          if (chatIndex > -1) {
            const updatedChat = { ...prevChats[chatIndex], latestMessage: data, updatedAt: new Date().toISOString() };
            const newChats = [...prevChats];
            newChats.splice(chatIndex, 1);
            return [updatedChat, ...newChats];
          }
          return prevChats;
        });
      } catch (error) {
        console.log('Error sending message');
        setMessages(prev => prev.filter(m => m._id !== tempId));
      }
    }
  };

  const sendMessageWithMedia = async (contentToSend, mediaUrl, mediaType, tempId) => {
    socket.emit('stop typing', selectedChat._id);
    try {
      const config = {
        headers: {
          'Content-type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
      };
      const { data } = await axios.post(
        `${ENDPOINT}/api/message`,
        {
          content: contentToSend,
          chatId: selectedChat._id,
          mediaUrl,
          mediaType
        },
        config
      );
      socket.emit('new message', data);
      setMessages(prev => prev.map(m => m._id === tempId ? { ...data, status: 'sent' } : m));
      setChats(prevChats => {
        const chatIndex = prevChats.findIndex(c => c._id === selectedChat._id);
        if (chatIndex > -1) {
          const updatedChat = { ...prevChats[chatIndex], latestMessage: data, updatedAt: new Date().toISOString() };
          const newChats = [...prevChats];
          newChats.splice(chatIndex, 1);
          return [updatedChat, ...newChats];
        }
        return prevChats;
      });
    } catch (error) {
      console.log('Error sending message');
      setMessages(prev => prev.filter(m => m._id !== tempId));
    }
  };

  const submitEditMessage = async () => {
    try {
      const config = { headers: { 'Content-type': 'application/json', Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.put(`${ENDPOINT}/api/message/${editingMessageId}`, { content: encryptMessage(editContent, selectedChat._id) }, config);
      
      const decryptedData = {
        ...data,
        content: data.isDeleted ? data.content : decryptMessage(data.content, selectedChat._id),
        replyTo: data.replyTo ? { ...data.replyTo, content: data.replyTo.isDeleted ? data.replyTo.content : decryptMessage(data.replyTo.content, selectedChat._id) } : null
      };

      setMessages((prev) => prev.map(m => m._id === decryptedData._id ? decryptedData : m));
      socket.emit('message edited', data);
      setEditingMessageId(null);
      setEditContent('');
    } catch (error) {
      console.log('Error editing message');
    }
  };

  const deleteMessage = async (messageId, type) => {
    if(!window.confirm(`Are you sure you want to delete this message for ${type}?`)) return;
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      if (type === 'me') {
        await axios.delete(`${ENDPOINT}/api/message/${messageId}?type=me`, config);
        setMessages((prev) => prev.filter(m => m._id !== messageId));
      } else {
        const { data } = await axios.delete(`${ENDPOINT}/api/message/${messageId}?type=everyone`, config);
        setMessages((prev) => prev.map(m => m._id === data._id ? data : m));
        socket.emit('message deleted', data);
      }
      setDropdownMessageId(null);
    } catch (error) {
      console.log('Error deleting message');
    }
  };

  const deleteChat = async (chatId, e) => {
    e.stopPropagation();
    if(!window.confirm("Are you sure you want to delete this chat for yourself?")) return;
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.delete(`${ENDPOINT}/api/chat/${chatId}`, config);
      setChats(chats.filter(c => c._id !== chatId));
      if(selectedChat?._id === chatId) setSelectedChat(null);
      setActiveChatMenuId(null);
    } catch (error) {
      console.log('Error deleting chat');
    }
  };

  const clearChat = async (chatId, e) => {
    e.stopPropagation();
    if(!window.confirm("Are you sure you want to clear this chat? This will remove all messages for you.")) return;
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.put(`${ENDPOINT}/api/chat/clear`, { chatId }, config);
      if(selectedChat?._id === chatId) {
        setMessages([]);
      }
      setActiveChatMenuId(null);
    } catch (error) {
      console.log('Error clearing chat');
    }
  };

  const handleScheduleSubmit = async () => {
    if (!scheduledMessageContent.trim() || !scheduledDate || !scheduledTime) {
      alert("Please enter message, date, and time.");
      return;
    }
    const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    if (scheduledDateTime <= new Date()) {
      alert("Please select a future date and time.");
      return;
    }
    
    try {
      const config = {
        headers: {
          'Content-type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
      };
      await axios.post(
        `${ENDPOINT}/api/message/schedule`,
        {
          content: scheduledMessageContent,
          chatId: schedulingChatId,
          scheduledFor: scheduledDateTime.toISOString(),
        },
        config
      );
      alert("Message scheduled successfully!");
      setIsScheduleModalOpen(false);
      setScheduledMessageContent('');
      setScheduledDate('');
      setScheduledTime('');
      setSchedulingChatId(null);
    } catch (error) {
      console.log('Error scheduling message');
      alert("Failed to schedule message.");
    }
  };

  const handleSetSelfDestructSubmit = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.put(`${ENDPOINT}/api/chat/selfdestruct`, {
        chatId: selfDestructChatId,
        timer: selfDestructTimer === 0 ? null : selfDestructTimer
      }, config);
      
      setChats(chats.map(c => c._id === data._id ? data : c));
      if(selectedChat?._id === data._id) setSelectedChat(data);
      
      alert(selfDestructTimer === 0 ? "Self-destruct timer disabled." : "Self-destruct timer updated.");
      setIsSelfDestructModalOpen(false);
      setSelfDestructTimer(null);
      setSelfDestructChatId(null);
    } catch (error) {
      console.log('Error setting self destruct timer');
      alert("Failed to set self-destruct timer.");
    }
  };

  const handleSummarize = async (messageId) => {
    try {
      setDropdownMessageId(null);
      setIsSummarizing(true);
      setIsSummaryModalOpen(true);
      setSummaryContent('');

      const msgToSummarize = messages.find(m => m._id === messageId);
      const contentToSummarize = msgToSummarize ? msgToSummarize.content : '';

      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.post(`${ENDPOINT}/api/message/${messageId}/summarize`, { content: contentToSummarize }, config);

      setSummaryContent(data.summary);
      setIsSummarizing(false);
    } catch (error) {
      console.log('Error summarizing message');
      setSummaryContent(error.response?.data?.message || 'Failed to summarize message.');
      setIsSummarizing(false);
    }
  };

  const handleReactToMessage = async (messageId, emoji) => {
    try {
      const config = { headers: { 'Content-type': 'application/json', Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.put(`${ENDPOINT}/api/message/${messageId}/react`, { emoji }, config);
      setMessages((prev) => prev.map(m => m._id === data._id ? data : m));
      socket.emit('message reacted', data);
      setDropdownMessageId(null);
    } catch (error) {
      console.log('Error reacting to message');
    }
  };

  const handleTogglePin = async (messageId) => {
    try {
      setDropdownMessageId(null);
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.put(`${ENDPOINT}/api/message/${messageId}/pin`, {}, config);
      
      const decryptedData = {
        ...data,
        content: data.isDeleted ? data.content : decryptMessage(data.content, selectedChat._id),
        replyTo: data.replyTo ? { ...data.replyTo, content: data.replyTo.isDeleted ? data.replyTo.content : decryptMessage(data.replyTo.content, selectedChat._id) } : null
      };
      
      setMessages((prev) => prev.map(m => m._id === decryptedData._id ? decryptedData : m));
      socket.emit('message pinned', data);
    } catch (error) {
      console.log('Error toggling pin status');
    }
  };

  const handleForwardMessage = (message) => {
    setDropdownMessageId(null);
    setForwardingMessage(message);
    setIsForwardModalOpen(true);
  };

  const handleSendForward = async (targetChatId) => {
    try {
      setIsForwardModalOpen(false);
      const config = { headers: { 'Content-type': 'application/json', Authorization: `Bearer ${user.token}` } };
      
      const contentToSend = forwardingMessage.content;
      const encryptedContent = encryptMessage(contentToSend, targetChatId);
      
      const { data } = await axios.post(
        `${ENDPOINT}/api/message`,
        {
          content: encryptedContent,
          chatId: targetChatId,
          mediaUrl: forwardingMessage.mediaUrl,
          mediaType: forwardingMessage.mediaType
        },
        config
      );
      
      socket.emit('new message', data);
      setForwardingMessage(null);
      
      setChats(prevChats => {
        const newChats = [...prevChats];
        const chatIndex = newChats.findIndex(c => c._id === targetChatId);
        let chatToMove;
        if (chatIndex !== -1) {
          chatToMove = newChats.splice(chatIndex, 1)[0];
        } else {
          chatToMove = data.chat;
        }
        chatToMove.latestMessage = data;
        return [chatToMove, ...newChats];
      });
      
      if (selectedChat && selectedChat._id === targetChatId) {
        const decryptedData = {
          ...data,
          content: data.isDeleted ? data.content : decryptMessage(data.content, targetChatId),
          replyTo: null
        };
        setMessages(prev => [...prev, decryptedData]);
      } else {
        alert("Message forwarded successfully!");
      }
    } catch (error) {
      console.log('Error forwarding message');
    }
  };

  const startVideoCall = async () => {
    const roomId = `Nexora-${selectedChat._id}-${Math.floor(Math.random() * 1000000)}`;
    const url = `https://meet.jit.si/${roomId}`;
    window.open(url, '_blank');

    const linkMessage = `📞 Started a video call. Click here to join: ${url}`;
    try {
      const config = { headers: { 'Content-type': 'application/json', Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.post(`${ENDPOINT}/api/message`, { content: linkMessage, chatId: selectedChat._id }, config);
      socket.emit('new message', data);
      setMessages([...messages, data]);
    } catch (error) {
      console.log('Error sending video call link');
    }
  };

  const handleSearch = async (query) => {
    setSearch(query);
    if (!query) {
      setSearchResult([]);
      return;
    }
    try {
      setLoading(true);
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.get(`${ENDPOINT}/api/user?search=${query}`, config);
      setLoading(false);
      setSearchResult(data);
    } catch (error) {
      setLoading(false);
    }
  };

  const accessChat = async (userId) => {
    try {
      setLoadingChat(true);
      const config = { headers: { 'Content-type': 'application/json', Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.post(`${ENDPOINT}/api/chat`, { userId }, config);

      if (!chats.find((c) => c._id === data._id)) setChats([data, ...chats]);
      setSelectedChat(data);
      setLoadingChat(false);
      setIsSearchModalOpen(false);
    } catch (error) {
      setLoadingChat(false);
    }
  };

  const handleGroupAdd = (userToAdd) => {
    if (selectedUsers.includes(userToAdd)) return;
    setSelectedUsers([...selectedUsers, userToAdd]);
  };

  const handleGroupRemove = (delUser) => {
    setSelectedUsers(selectedUsers.filter(sel => sel._id !== delUser._id));
  };

  const handleRenameGroup = async () => {
    if (!newGroupName) return;
    try {
      setRenameLoading(true);
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.put(`${ENDPOINT}/api/chat/rename`, {
        chatId: selectedChat._id,
        chatName: newGroupName,
      }, config);

      setSelectedChat(data);
      setChats(chats.map((c) => (c._id === data._id ? data : c)));
      setRenameLoading(false);
      setNewGroupName('');
      setIsRenamingGroup(false);
    } catch (error) {
      setRenameLoading(false);
      alert(error.response?.data?.message || 'Error occurred');
    }
  };

  const handleSubmitGroup = async () => {
    if (!groupChatName || selectedUsers.length < 2) {
      alert("Please enter a group name and select at least 2 users.");
      return;
    }
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.post(`${ENDPOINT}/api/chat/group`, {
        name: groupChatName,
        users: JSON.stringify(selectedUsers.map((u) => u._id)),
      }, config);
      setChats([data, ...chats]);
      setIsGroupModalOpen(false);
      setSelectedUsers([]);
      setGroupChatName('');
    } catch(err) { 
      console.log(err); 
    }
  };

  const handleUpdateProfile = async () => {
    try {
      setProfileUpdating(true);
      const config = { headers: { 'Content-type': 'application/json', Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.put(`${ENDPOINT}/api/user/profile`, {
        name: profileName,
        pic: profilePicUrl
      }, config);
      localStorage.setItem('userInfo', JSON.stringify(data));
      setUser(data);
      setProfileUpdating(false);
      setIsProfileModalOpen(false);
    } catch (error) {
      setProfileUpdating(false);
      alert('Error updating profile');
    }
  };

  const handleProfilePicUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setPicUploading(true);
    const data = new FormData();
    data.append('file', file);
    data.append('upload_preset', 'real time chat'); // Updated to your preset name
    data.append('cloud_name', 'derbhvomh'); // User's cloud name

    try {
      const res = await fetch('https://api.cloudinary.com/v1_1/derbhvomh/image/upload', {
        method: 'post',
        body: data,
      });
      const uploadData = await res.json();
      if (uploadData.url) {
        setProfilePicUrl(uploadData.url);
      } else {
        alert('Failed to upload image.');
      }
      setPicUploading(false);
    } catch (err) {
      console.log(err);
      alert('Failed to upload image.');
      setPicUploading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailSubject.trim() || !emailMessage.trim()) {
      alert("Please enter both subject and message.");
      return;
    }

    try {
      setEmailSending(true);
      const config = { headers: { 'Content-type': 'application/json', Authorization: `Bearer ${user.token}` } };
      
      if (selectedChat.isGroupChat) {
        const { data } = await axios.post(`${ENDPOINT}/api/chat/groupemail`, {
          chatId: selectedChat._id,
          subject: emailSubject,
          message: emailMessage
        }, config);
        
        const isAdmin = selectedChat.groupAdmin?._id === user._id || selectedChat.coAdmins?.some(admin => admin._id === user._id);
        if (!isAdmin) {
          if (data.emailMessage) {
            setMessages((prev) => [...prev, data.emailMessage]);
            socket.emit("new message", data.emailMessage);
          }
          alert("Email request sent to admin for approval!");
        } else {
          if (data.emailMessage) {
            setMessages((prev) => [...prev, data.emailMessage]);
            socket.emit("new message", data.emailMessage);
          }
          alert("Email sent successfully to the group!");
        }
      } else {
        const recipient = selectedChat.users[0]._id === user._id ? selectedChat.users[1] : selectedChat.users[0];
        const { data } = await axios.post(`${ENDPOINT}/api/user/send-email`, {
          recipientEmail: recipient.email,
          subject: emailSubject,
          message: emailMessage,
          chatId: selectedChat._id
        }, config);
        if (data.emailMessage) {
          setMessages((prev) => [...prev, data.emailMessage]);
          socket.emit("new message", data.emailMessage);
        }
        alert("Email sent successfully!");
      }
      
      setEmailSending(false);
      setIsEmailModalOpen(false);
      setEmailSubject('');
      setEmailMessage('');
    } catch (error) {
      setEmailSending(false);
      alert(error.response?.data?.message || "Failed to send email. Please try again.");
    }
  };

  const handleRemoveUserFromGroup = async (userToRemove) => {
    const isAdmin = selectedChat.groupAdmin?._id === user._id || selectedChat.coAdmins?.some(admin => admin._id === user._id);
    if (!isAdmin && userToRemove._id !== user._id) {
      alert('Only admins can remove someone!');
      return;
    }

    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.put(`${ENDPOINT}/api/chat/groupremove`, {
        chatId: selectedChat._id,
        userId: userToRemove._id,
      }, config);

      userToRemove._id === user._id ? setSelectedChat(null) : setSelectedChat(data);
      fetchChats();
    } catch (error) {
      alert(error.response?.data?.message || 'Error occurred');
    }
  };

  const handleApproveEmail = async (emailId) => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.put(`${ENDPOINT}/api/chat/groupemail/approve`, {
        chatId: selectedChat._id,
        emailId
      }, config);
      setSelectedChat(data.updatedChat);
      if (data.emailMessage) {
        setMessages((prev) => [...prev, data.emailMessage]);
        socket.emit("new message", data.emailMessage);
      }
      fetchChats();
      alert("Email approved and sent!");
    } catch (error) {
      alert(error.response?.data?.message || 'Error approving email');
    }
  };

  const handleRejectEmail = async (emailId) => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.put(`${ENDPOINT}/api/chat/groupemail/reject`, {
        chatId: selectedChat._id,
        emailId
      }, config);
      setSelectedChat(data);
      fetchChats();
      alert("Email request rejected.");
    } catch (error) {
      alert(error.response?.data?.message || 'Error rejecting email');
    }
  };

  const handleAddUserToGroup = async (userToAdd) => {
    if (selectedChat.users.find((u) => u._id === userToAdd._id)) {
      alert('User Already in group!');
      return;
    }
    const isAdmin = selectedChat.groupAdmin?._id === user._id || selectedChat.coAdmins?.some(admin => admin._id === user._id);
    if (!isAdmin) {
      alert('Only admins can add someone!');
      return;
    }

    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.put(`${ENDPOINT}/api/chat/groupadd`, {
        chatId: selectedChat._id,
        userId: userToAdd._id,
      }, config);

      setSelectedChat(data);
      setSearchResult([]);
      setSearch('');
      fetchChats();
    } catch (error) {
      alert(error.response?.data?.message || 'Error occurred');
    }
  };

  const handleMakeAdmin = async (userToPromote) => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.put(`${ENDPOINT}/api/chat/groupadmin/make`, {
        chatId: selectedChat._id,
        userId: userToPromote._id,
      }, config);
      setSelectedChat(data);
      fetchChats();
    } catch (error) {
      alert(error.response?.data?.message || 'Error occurred');
    }
  };

  const handleRemoveAdmin = async (userToDemote) => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.put(`${ENDPOINT}/api/chat/groupadmin/remove`, {
        chatId: selectedChat._id,
        userId: userToDemote._id,
      }, config);
      setSelectedChat(data);
      fetchChats();
    } catch (error) {
      alert(error.response?.data?.message || 'Error occurred');
    }
  };

  const updateGroupPicture = async (e) => {
    const file = e.target.files[0];
    if(!file) return;

    setGroupPicUploading(true);
    const data = new FormData();
    data.append('file', file);
    data.append('upload_preset', 'real time chat');
    data.append('cloud_name', 'derbhvomh');

    try {
      const res = await fetch('https://api.cloudinary.com/v1_1/derbhvomh/image/upload', {
        method: 'post',
        body: data,
      });
      const uploadData = await res.json();
      if(uploadData.url) {
        const config = { headers: { Authorization: `Bearer ${user.token}` } };
        const { data: updatedChat } = await axios.put(`${ENDPOINT}/api/chat/grouppic`, {
          chatId: selectedChat._id,
          pic: uploadData.url
        }, config);
        
        setSelectedChat(updatedChat);
        setChats(chats.map(c => c._id === updatedChat._id ? updatedChat : c));
      }
      setGroupPicUploading(false);
    } catch (err) {
      console.log(err);
      setGroupPicUploading(false);
    }
  };

  const uploadMedia = async (e) => {
    const file = e.target.files[0];
    if(!file) return;

    // Optimistic UI for image
    const localUrl = URL.createObjectURL(file);
    const contentToSend = newMessage;
    const tempId = `temp-${Date.now()}`;
    const tempMsg = {
      _id: tempId,
      sender: user,
      content: contentToSend,
      chat: selectedChat,
      mediaUrl: localUrl,
      mediaType: file.type,
      createdAt: new Date().toISOString(),
      status: 'sending'
    };
    
    setMessages(prev => [...prev, tempMsg]);
    setNewMessage('');
    setAttachmentUploading(true);

    // Cloudinary setup (User needs to replace credentials)
    const data = new FormData();
    data.append('file', file);
    data.append('upload_preset', 'real time chat'); // Updated to your preset name
    data.append('cloud_name', 'derbhvomh'); // User's cloud name

    try {
      const res = await fetch('https://api.cloudinary.com/v1_1/derbhvomh/image/upload', {
        method: 'post',
        body: data,
      });
      const uploadData = await res.json();
      if(uploadData.url) {
        sendMessageWithMedia(contentToSend, uploadData.url, file.type, tempId);
      } else {
        alert("Cloudinary credentials not set up. Please update them in ChatPage.jsx.");
        setMessages(prev => prev.filter(m => m._id !== tempId));
      }
      setAttachmentUploading(false);
    } catch (err) {
      console.log(err);
      alert("Cloudinary credentials not set up. Please update them in ChatPage.jsx.");
      setMessages(prev => prev.filter(m => m._id !== tempId));
      setAttachmentUploading(false);
    }
  };

  const defaultSingleAvatar = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2394a3b8"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
  const defaultGroupAvatar = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2394a3b8"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`;

  const getAvatar = (chat) => {
    if (chat.isGroupChat) {
      return chat.groupPic || defaultGroupAvatar;
    }
    const otherUser = chat.users[0]._id === user._id ? chat.users[1] : chat.users[0];
    const pic = otherUser?.pic;
    if (!pic || pic === 'https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg') {
      return defaultSingleAvatar;
    }
    return pic;
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', padding: '0', gap: '20px' }}>
      
      {/* Sidebar - Chat List */}
      <div className={`sidebar glass-panel ${selectedChat ? 'hide-on-mobile' : ''}`} style={{ width: '30%', display: 'flex', flexDirection: 'column', padding: '0', border: 'none', background: 'var(--surface-color)', overflow: 'hidden', position: 'relative' }}>
        <div className={`panel-pattern pattern-${panelPattern}`}></div>
        <div style={{ padding: '20px 20px 10px 20px', position: 'relative', zIndex: 1 }}>
          
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', gap: '10px' }}>
            <img src="/nexora-logo-transparent.png" alt="Nexora" style={{ width: '35px', height: '35px', objectFit: 'contain' }} />
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 'bold', background: 'linear-gradient(135deg, #a8c0ff 0%, #3f2b96 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '0.5px' }}>Nexora</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(128,128,128,0.1)', borderRadius: '25px', padding: '8px 15px', marginBottom: '20px', border: '1px solid var(--border-color)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input
              type="text"
              placeholder="Search or start a new chat"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', marginLeft: '10px', width: '100%', fontSize: '0.9rem' }}
              value={chatSearchQuery}
              onChange={(e) => setChatSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', position: 'relative' }}>
            <button className="btn-primary" onClick={() => setIsSearchModalOpen(true)} style={{ flex: 1, padding: '10px', fontSize: '0.85rem' }}>
              New Chat
            </button>
            <button className="btn-primary" onClick={() => setIsGroupModalOpen(true)} style={{ flex: 1, padding: '10px', fontSize: '0.85rem' }}>
              New Group
            </button>
            <button 
              className="menu-exclude"
              onClick={() => setIsMenuOpen(!isMenuOpen)} 
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '1.5rem', cursor: 'pointer', padding: '0 5px' }}
            >
              ⋮
            </button>
            {isMenuOpen && (
              <div className="menu-exclude" style={{ position: 'absolute', top: '100%', right: 0, background: 'var(--surface-color)', borderRadius: '8px', boxShadow: 'var(--glass-shadow)', zIndex: 10, minWidth: '150px', border: '1px solid var(--border-color)', backdropFilter: 'blur(20px)', overflow: 'hidden' }}>
                <div 
                  onClick={() => { setIsProfileModalOpen(true); setIsMenuOpen(false); }} 
                  style={{ padding: '12px 15px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >Profile</div>
                <div 
                  onClick={() => { setIsSettingsModalOpen(true); setIsMenuOpen(false); }} 
                  style={{ padding: '12px 15px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >Settings</div>
                <div 
                  onClick={() => { setIsAccountsModalOpen(true); setIsMenuOpen(false); }} 
                  style={{ padding: '12px 15px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >Switch Account</div>
                <div 
                  onClick={handleLogout} 
                  style={{ padding: '12px 15px', cursor: 'pointer', color: '#ef4444', fontSize: '0.9rem' }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >Logout</div>
              </div>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {[...chats]
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
            .filter(chat => {
              if (!chatSearchQuery) return true;
              const chatName = chat.isGroupChat 
                ? chat.chatName 
                : (chat.users[0]._id === user._id ? chat.users[1]?.name : chat.users[0]?.name);
              return chatName?.toLowerCase().includes(chatSearchQuery.toLowerCase());
          }).map((chat) => (
            <div
              key={chat._id}
              onClick={() => {
                setSelectedChat(chat);
                fetchMessages(chat._id);
                setNewMessage('');
                setUnreadCounts(prev => {
                  const newCounts = { ...prev };
                  delete newCounts[chat._id];
                  return newCounts;
                });
              }}
              className="animate-chat-item"
              style={{
                padding: '16px',
                background: selectedChat?._id === chat._id ? 'var(--primary-gradient)' : 'var(--surface-color)',
                borderRadius: '16px',
                marginBottom: '12px',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: selectedChat?._id === chat._id ? '0 10px 20px rgba(0,0,0,0.15)' : 'none',
                border: selectedChat?._id === chat._id ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (selectedChat?._id !== chat._id) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedChat?._id !== chat._id) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.background = 'var(--surface-color)';
                  e.currentTarget.style.borderColor = 'transparent';
                }
              }}
            >
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flex: 1, overflow: 'hidden' }}>
                <div 
                  onClick={(e) => { e.stopPropagation(); setEnlargedImage(getAvatar(chat)); }}
                  style={{ width: '45px', height: '45px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', flexShrink: 0, cursor: 'pointer' }}
                >
                  <img 
                    src={getAvatar(chat)} 
                    alt="avatar" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontWeight: '500' }}>
                    {!chat.isGroupChat
                      ? chat.users[0]._id === user._id ? chat.users[1]?.name || 'Unknown User' : chat.users[0]?.name || 'Unknown User'
                      : chat.chatName}
                  </div>
                {chat.latestMessage && (() => {
                  const isSentByMe = chat.latestMessage.sender._id === user._id;
                  const isDeletedForMe = chat.latestMessage.deletedBy && chat.latestMessage.deletedBy.includes(user._id);
                  const decryptedContent = decryptMessage(chat.latestMessage.content, chat._id);
                  const messageContent = (chat.latestMessage.isDeleted || isDeletedForMe) ? <i>This message was deleted</i> : (decryptedContent || "Media");
                  
                  return (
                    <div style={{ fontSize: '0.8rem', color: selectedChat?._id === chat._id ? 'white' : 'var(--text-secondary)', marginTop: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {chat.isGroupChat ? (
                        <>
                          <b>{isSentByMe ? "You" : chat.latestMessage.sender.name.split(' ')[0]} : </b>
                          {messageContent}
                        </>
                      ) : (
                        <>
                          {messageContent}
                          {isSentByMe && <span style={{ marginLeft: '4px', color: selectedChat?._id === chat._id ? 'white' : '#a7f3d0' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'text-bottom' }}><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg></span>}
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                {chat.latestMessage && (
                  <span style={{ fontSize: '0.75rem', color: selectedChat?._id === chat._id ? 'white' : 'var(--text-secondary)' }}>
                    {new Date(chat.latestMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                {unreadCounts[chat._id] > 0 ? (
                  <div style={{
                    background: '#f97316', // Orange badge like the image
                    color: 'white',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                  }}>
                    {unreadCounts[chat._id]}
                  </div>
                ) : (
                  <div style={{ height: '20px' }}></div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', position: 'relative', overflow: 'hidden' }}>
        <div className={`panel-pattern pattern-${panelPattern}`}></div>
        {selectedChat ? (
          <>
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '15px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div 
                  onClick={() => setEnlargedImage(getAvatar(selectedChat))}
                  style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', flexShrink: 0, cursor: 'pointer' }}
                >
                  <img 
                    src={getAvatar(selectedChat)} 
                    alt="avatar" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <h2 
                    onClick={() => {
                      if (selectedChat.isGroupChat) {
                        setIsGroupInfoModalOpen(true);
                      } else {
                        setModalUser(selectedChat.users[0]._id === user._id ? selectedChat.users[1] : selectedChat.users[0]);
                        setIsUserInfoModalOpen(true);
                      }
                    }}
                    style={{ fontSize: '1.2rem', fontWeight: '600', margin: 0, cursor: 'pointer', lineHeight: '1.2' }}
                  >
                    {!selectedChat.isGroupChat
                      ? selectedChat.users[0]._id === user._id ? selectedChat.users[1]?.name || 'Unknown User' : selectedChat.users[0]?.name || 'Unknown User'
                      : selectedChat.chatName.toUpperCase()}
                  </h2>
                  {isTyping ? (
                    <span style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '2px' }}>
                      <i>typing...</i>
                    </span>
                  ) : selectedChat.isGroupChat ? (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {selectedChat.users.length} members
                    </span>
                  ) : null}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button 
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '5px', transition: 'color 0.2s', display: 'flex', alignItems: 'center' }}
                  onClick={startVideoCall}
                  title="Video Call"
                  onMouseEnter={(e) => e.target.style.color = 'var(--text-primary)'}
                  onMouseLeave={(e) => e.target.style.color = 'var(--text-secondary)'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
                  </button>
                  <button 
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '5px', transition: 'color 0.2s', display: 'flex', alignItems: 'center' }}
                    onClick={() => setIsEmailModalOpen(true)}
                    title="Send Email"
                    onMouseEnter={(e) => e.target.style.color = 'var(--text-primary)'}
                    onMouseLeave={(e) => e.target.style.color = 'var(--text-secondary)'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                  </button>
                
                <div style={{ position: 'relative' }}>
                  <button 
                    className="menu-exclude"
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '5px', fontSize: '1.2rem', transition: 'color 0.2s', display: 'flex', alignItems: 'center' }}
                    onClick={() => setActiveChatMenuId(activeChatMenuId === 'header' ? null : 'header')}
                    title="Options"
                    onMouseEnter={(e) => e.target.style.color = 'var(--text-primary)'}
                    onMouseLeave={(e) => e.target.style.color = 'var(--text-secondary)'}
                  >
                    ⋮
                  </button>
                  {activeChatMenuId === 'header' && (
                    <div className="menu-exclude" style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      background: 'var(--surface-color)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '5px 0',
                      zIndex: 20,
                      minWidth: '180px',
                      boxShadow: 'var(--glass-shadow)',
                      backdropFilter: 'blur(10px)'
                    }}>
                      <div 
                        onClick={(e) => { clearChat(selectedChat._id, e); setActiveChatMenuId(null); }}
                        style={{ padding: '10px 15px', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                        onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                      >Clear Chat</div>
                      <div 
                        onClick={(e) => { deleteChat(selectedChat._id, e); setActiveChatMenuId(null); }}
                        style={{ padding: '10px 15px', cursor: 'pointer', color: '#ff4d4d', fontSize: '0.85rem', borderBottom: '1px solid var(--border-color)' }}
                        onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                      >Delete Chat</div>
                      <div 
                        onClick={(e) => { setSchedulingChatId(selectedChat._id); setIsScheduleModalOpen(true); setActiveChatMenuId(null); }}
                        style={{ padding: '10px 15px', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                        onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                      >Schedule Message</div>
                      <div 
                        onClick={(e) => { setSelfDestructChatId(selectedChat._id); setSelfDestructTimer(selectedChat.selfDestructTimer || null); setIsSelfDestructModalOpen(true); setActiveChatMenuId(null); }}
                        style={{ padding: '10px 15px', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                        onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                      >Self-Destruct Timer</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '10px' }}>
              {(() => {
                const pinnedMessages = messages.filter(m => m.isPinned && !m.isDeleted);
                if (pinnedMessages.length === 0) return null;
                const lastPinned = pinnedMessages[pinnedMessages.length - 1];
                return (
                  <div style={{
                    background: 'rgba(255,255,255,0.05)',
                    borderLeft: '4px solid var(--primary)',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    marginBottom: '10px',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                  }}>
                    <span style={{ fontSize: '1.2rem' }}>📌</span>
                    <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                      <strong style={{ color: 'var(--primary)', marginRight: '5px' }}>{lastPinned.sender._id === user._id ? 'You' : lastPinned.sender.name}:</strong>
                      <span style={{ color: 'var(--text-secondary)' }}>{lastPinned.content || 'Media'}</span>
                    </div>
                  </div>
                );
              })()}
              {messages.map((m, i) => (
                <div key={m._id} style={{ display: 'flex', justifyContent: m.sender._id === user._id ? 'flex-end' : 'flex-start' }}
                     onMouseEnter={() => setHoveredMessageId(m._id)}
                     onMouseLeave={() => setHoveredMessageId(null)}>
                  <div className={`animate-message ${m.sender._id === user._id ? 'chat-bubble-user' : 'chat-bubble-other'}`} style={{
                    opacity: m.isDeleted ? 0.7 : 1,
                    position: 'relative',
                    zIndex: dropdownMessageId === m._id ? 50 : (hoveredMessageId === m._id ? 40 : 1)
                  }}>
                    {selectedChat.isGroupChat && m.sender._id !== user._id && !m.isDeleted && !m.content?.startsWith('mail sent by') && (
                      <div 
                        onClick={() => {
                          setModalUser(m.sender);
                          setIsUserInfoModalOpen(true);
                        }}
                        style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '4px', cursor: 'pointer' }}
                      >
                        {m.sender.name}
                      </div>
                    )}
                    {m.mediaUrl && (
                      <img src={m.mediaUrl} alt="media" style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: m.content ? '10px' : '0' }} />
                    )}

                    {m.replyTo && !m.isDeleted && (
                      <div 
                        style={{ 
                          background: 'rgba(0,0,0,0.2)', 
                          borderLeft: '4px solid var(--primary)', 
                          padding: '5px 10px', 
                          marginBottom: '8px', 
                          borderRadius: '4px', 
                          fontSize: '0.8rem'
                        }}
                      >
                        <strong style={{ color: 'var(--primary)', display: 'block', marginBottom: '2px' }}>
                          {m.replyTo.sender?._id === user._id ? 'You' : (m.replyTo.sender?.name || 'Unknown User')}
                        </strong>
                        <span style={{ fontStyle: m.replyTo.isDeleted ? 'italic' : 'normal', opacity: 0.8 }}>
                           {m.replyTo.isDeleted ? 'This message was deleted' : m.replyTo.content}
                        </span>
                      </div>
                    )}

                    {editingMessageId === m._id ? (
                      <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                        <input type="text" value={editContent} onChange={(e) => setEditContent(e.target.value)} style={{ padding: '5px', borderRadius: '4px', border: 'none', background: 'rgba(255,255,255,0.2)', color: 'white' }} />
                        <button onClick={submitEditMessage} style={{ background: 'white', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '0 10px' }}>Save</button>
                        <button onClick={() => { setEditingMessageId(null); setDropdownMessageId(null); }} style={{ background: 'transparent', color: 'white', border: '1px solid white', borderRadius: '4px', cursor: 'pointer', padding: '0 10px' }}>Cancel</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontStyle: m.isDeleted || m.content?.startsWith('mail sent by') ? 'italic' : 'normal', opacity: m.isDeleted ? 0.7 : 1 }}>
                          {m.content && m.content.includes('https://meet.jit.si/') ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <span>📞 Started a video call.</span>
                              <button 
                                onClick={() => {
                                  const url = m.content.match(/https:\/\/meet\.jit\.si\/[^\s]+/)[0];
                                  window.open(url, '_blank');
                                }}
                                className="btn-accent"
                                style={{ padding: '8px 15px', fontSize: '0.85rem', width: 'auto', display: 'inline-block', textAlign: 'center', borderRadius: '8px' }}
                              >
                                Join Video Call
                              </button>
                            </div>
                          ) : (
                            m.content
                          )}
                        </span>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'flex-end',
                          alignItems: 'center',
                          gap: '5px',
                          marginTop: '4px',
                          fontSize: '0.65rem',
                          opacity: 0.6,
                        }}>
                          {m.isEdited && !m.isDeleted && <span>(edited)</span>}
                          <span>{formatTime(m.createdAt)}</span>
                          {m.sender._id === user._id && !m.isDeleted && (
                            <span style={{ 
                              marginLeft: '4px', 
                              fontSize: m.status === 'sending' ? '0.65rem' : '0.8rem', 
                              fontStyle: m.status === 'sending' ? 'italic' : 'normal',
                              color: m.status === 'sending' ? 'inherit' : '#a7f3d0'
                            }}>
                              {m.status === 'sending' ? 'sending...' : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'text-bottom' }}><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Render Reactions */}
                    {m.reactions && m.reactions.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        bottom: '-10px',
                        right: m.sender._id === user._id ? '10px' : '-10px',
                        background: 'rgba(20,20,30,0.9)',
                        borderRadius: '10px',
                        padding: '2px 6px',
                        display: 'flex',
                        gap: '2px',
                        fontSize: '0.8rem',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        zIndex: 2
                      }}>
                        {Array.from(new Set(m.reactions.map(r => r.emoji))).map(emoji => {
                          const hasReacted = m.reactions.some(r => r.emoji === emoji && (r.user === user._id || r.user?._id === user._id));
                          return (
                            <span 
                              key={emoji} 
                              onClick={() => { if(hasReacted) handleReactToMessage(m._id, emoji); }}
                              style={{ display: 'flex', alignItems: 'center', cursor: hasReacted ? 'pointer' : 'default', background: hasReacted ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: '4px', padding: '1px 3px', transition: 'background 0.2s' }}
                              title={hasReacted ? "Click to remove reaction" : ""}
                            >
                              {emoji} <span style={{ fontSize: '0.6rem', opacity: 0.8, marginLeft: '2px' }}>{m.reactions.filter(r => r.emoji === emoji).length > 1 ? m.reactions.filter(r => r.emoji === emoji).length : ''}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* Message Options Dropdown Arrow */}
                    {!m.isDeleted && (hoveredMessageId === m._id || dropdownMessageId === m._id) && (
                      <div 
                        className="menu-exclude"
                        onClick={() => setDropdownMessageId(dropdownMessageId === m._id ? null : m._id)}
                        style={{
                          position: 'absolute',
                          top: '5px',
                          right: m.sender._id === user._id ? '5px' : '-25px',
                          cursor: 'pointer',
                          background: 'rgba(0,0,0,0.5)',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          fontSize: '0.6rem',
                          color: 'white',
                          opacity: 0.8
                        }}
                      >
                        ▼
                      </div>
                    )}

                    {/* Dropdown Menu */}
                    {dropdownMessageId === m._id && !m.isDeleted && (
                      <div className="menu-exclude" style={{
                        position: 'absolute',
                        top: '30px',
                        right: m.sender._id === user._id ? '0' : '-120px',
                        background: 'var(--surface-color)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '5px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '5px',
                        zIndex: 10,
                        minWidth: '150px',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                        backdropFilter: 'blur(10px)'
                      }}>
                        {/* Quick Reactions */}
                        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '5px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                          {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                            <span 
                              key={emoji} 
                              style={{ cursor: 'pointer', fontSize: '1.2rem', transition: 'transform 0.2s' }}
                              onMouseEnter={(e) => e.target.style.transform = 'scale(1.2)'}
                              onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                              onClick={() => handleReactToMessage(m._id, emoji)}
                            >
                              {emoji}
                            </span>
                          ))}
                        </div>
                        {m.content && m.content.trim() !== '' && !m.content.includes('https://meet.jit.si/') && (
                          <div 
                            style={{ padding: '8px', cursor: 'pointer', fontSize: '0.8rem', borderRadius: '4px', color: '#a78bfa' }}
                            onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                            onMouseLeave={(e) => e.target.style.background = 'transparent'}
                            onClick={() => handleSummarize(m._id)}
                          >
                            ✨ Summarize
                          </div>
                        )}
                        <div 
                          style={{ padding: '8px', cursor: 'pointer', fontSize: '0.8rem', borderRadius: '4px', color: 'white' }}
                          onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                          onMouseLeave={(e) => e.target.style.background = 'transparent'}
                          onClick={() => handleTogglePin(m._id)}
                        >
                          {m.isPinned ? 'Unpin' : 'Pin'}
                        </div>
                        <div 
                          style={{ padding: '8px', cursor: 'pointer', fontSize: '0.8rem', borderRadius: '4px', color: 'white' }}
                          onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                          onMouseLeave={(e) => e.target.style.background = 'transparent'}
                          onClick={() => handleForwardMessage(m)}
                        >
                          Forward
                        </div>
                        <div 
                          style={{ padding: '8px', cursor: 'pointer', fontSize: '0.8rem', borderRadius: '4px', color: 'white' }}
                          onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                          onMouseLeave={(e) => e.target.style.background = 'transparent'}
                          onClick={() => { setReplyingToMessage(m); setDropdownMessageId(null); }}
                        >
                          Reply
                        </div>
                        {m.sender._id === user._id && (
                          <div 
                            style={{ padding: '8px', cursor: 'pointer', fontSize: '0.8rem', borderRadius: '4px', color: 'white' }}
                            onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                            onMouseLeave={(e) => e.target.style.background = 'transparent'}
                            onClick={() => { setEditingMessageId(m._id); setEditContent(m.content); setDropdownMessageId(null); }}
                          >
                            Edit
                          </div>
                        )}
                        <div 
                          style={{ padding: '8px', cursor: 'pointer', fontSize: '0.8rem', borderRadius: '4px', color: 'white' }}
                          onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                          onMouseLeave={(e) => e.target.style.background = 'transparent'}
                          onClick={() => deleteMessage(m._id, 'me')}
                        >
                          Delete for me
                        </div>
                        {m.sender._id === user._id && (
                          <div 
                            style={{ padding: '8px', cursor: 'pointer', fontSize: '0.8rem', borderRadius: '4px', color: '#ff4d4d' }}
                            onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                            onMouseLeave={(e) => e.target.style.background = 'transparent'}
                            onClick={() => deleteMessage(m._id, 'everyone')}
                          >
                            Delete for everyone
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div style={{ alignSelf: 'flex-start', color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                  Someone is typing...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {replyingToMessage && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderLeft: '4px solid var(--primary)', padding: '10px 15px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px', marginTop: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
                    Replying to {replyingToMessage.sender?._id === user._id ? 'yourself' : replyingToMessage.sender?.name}
                  </span>
                  <span style={{ color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '300px' }}>{replyingToMessage.content || 'Media attachment'}</span>
                </div>
                <button onClick={() => setReplyingToMessage(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.5rem', lineHeight: '1' }}>&times;</button>
              </div>
            )}

            {smartReplies.length > 0 && !replyingToMessage && selectedChat && (
              <div style={{ display: 'flex', gap: '10px', padding: '10px 15px', overflowX: 'auto', background: 'rgba(0,0,0,0.2)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px', marginTop: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '1.2rem' }}>✨</span>
                {isFetchingReplies ? (
                   <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Generating replies...</span>
                ) : (
                  smartReplies.map((reply, i) => (
                    <button 
                      key={i} 
                      onClick={() => setNewMessage(reply)}
                      style={{ background: 'var(--surface-color)', border: '1px solid var(--primary)', borderRadius: '20px', padding: '5px 15px', color: 'var(--text-primary)', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.85rem' }}
                      onMouseEnter={(e) => e.target.style.background = 'var(--primary)'}
                      onMouseLeave={(e) => e.target.style.background = 'var(--surface-color)'}
                    >
                      {reply}
                    </button>
                  ))
                )}
              </div>
            )}

            <div style={{ marginTop: (replyingToMessage || smartReplies.length > 0) ? '0' : '15px', borderTopLeftRadius: (replyingToMessage || smartReplies.length > 0) ? '0' : '24px', borderTopRightRadius: (replyingToMessage || smartReplies.length > 0) ? '0' : '24px', borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px', display: 'flex', alignItems: 'center', position: 'relative', background: 'var(--surface-color)', padding: '10px 15px', border: '1px solid var(--border-color)', boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.05)' }}>
              <span style={{ cursor: 'pointer', fontSize: '1.5rem', marginRight: '10px' }} onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                😊
              </span>
              {showEmojiPicker && (
                <div style={{ position: 'absolute', bottom: '60px', left: 0, zIndex: 100 }}>
                  <EmojiPicker 
                    onEmojiClick={(emojiObject) => setNewMessage(prev => prev + emojiObject.emoji)}
                    theme="dark"
                  />
                </div>
              )}
              <label style={{ cursor: 'pointer', fontSize: '1.5rem', opacity: attachmentUploading ? 0.5 : 1, marginRight: '10px' }}>
                📎
                <input type="file" style={{ display: 'none' }} accept="image/*" onChange={uploadMedia} disabled={attachmentUploading} />
              </label>
              <input
                type="text"
                style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '1rem', padding: '5px' }}
                placeholder={enterToSend ? "Type a message and press Enter..." : "Type a message..."}
                value={newMessage}
                onChange={typingHandler}
                onKeyDown={(e) => { if(e.key === 'Enter' && enterToSend) { sendMessage(e); setShowEmojiPicker(false); } }}
              />
              <button 
                onClick={(e) => { sendMessage(e); setShowEmojiPicker(false); }} 
                style={{ background: 'var(--primary-gradient)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', color: 'white', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0, fontSize: '1.2rem', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}
              >
                ➤
              </button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '1.2rem' }}>
            Click on a user to start chatting
          </div>
        )}
      </div>

      {/* Enlarged Image Modal */}
      {enlargedImage && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }} onClick={() => setEnlargedImage(null)}>
          <button style={{ position: 'absolute', top: '20px', right: '30px', background: 'transparent', border: 'none', color: 'white', fontSize: '2rem', cursor: 'pointer' }}>&times;</button>
          <img src={enlargedImage} alt="Enlarged" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '10px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Modals overlay */}
      {(isSearchModalOpen || isGroupModalOpen || isProfileModalOpen || isEmailModalOpen || isSettingsModalOpen || isGroupInfoModalOpen || isUserInfoModalOpen || isScheduleModalOpen || isSelfDestructModalOpen || isSummaryModalOpen || isForwardModalOpen || isAccountsModalOpen) && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1000
        }}>
          
          {/* Forward Message Modal */}
          {isForwardModalOpen && (
            <div className="glass-panel" style={{ width: '400px', padding: '20px', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                <h3 style={{ margin: 0 }}>Forward Message</h3>
                <button onClick={() => setIsForwardModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {forwardingMessage?.content ? forwardingMessage.content : 'Media Attachment'}
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {chats.map(chat => (
                  <div 
                    key={chat._id} 
                    onClick={() => handleSendForward(chat._id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: '8px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <img src={getAvatar(chat)} alt="avatar" style={{ width: '35px', height: '35px', borderRadius: '50%', objectFit: 'cover' }} />
                    <span>{!chat.isGroupChat ? (chat.users[0]._id === user._id ? chat.users[1]?.name : chat.users[0]?.name) : chat.chatName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Search User Modal */}
          {isSearchModalOpen && (
            <div className="glass-panel" style={{ width: '400px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ margin: 0 }}>Search Users</h3>
                <button onClick={() => {setIsSearchModalOpen(false); setSearchResult([]); setSearch('');}} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <input
                  type="text"
                  placeholder="Search by name or email"
                  className="input-field"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  style={{ marginBottom: 0 }}
                />
              </div>
              
              {loading ? (
                <div style={{ textAlign: 'center' }}>Loading...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                  {searchResult.map(resUser => (
                    <div
                      key={resUser._id}
                      onClick={() => accessChat(resUser._id)}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        padding: '10px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '15px'
                      }}
                    >
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', flexShrink: 0 }}>
                        <img 
                          src={(!resUser.pic || resUser.pic === 'https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg') ? defaultSingleAvatar : resUser.pic} 
                          alt={resUser.name} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                      </div>
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{resUser.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{resUser.email}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {loadingChat && <div style={{ marginTop: '10px', textAlign: 'center' }}>Loading Chat...</div>}
            </div>
          )}

          {/* Group Chat Modal */}
          {isGroupModalOpen && (
            <div className="glass-panel" style={{ width: '400px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ margin: 0 }}>Create Group Chat</h3>
                <button onClick={() => {setIsGroupModalOpen(false); setSearchResult([]); setSearch(''); setSelectedUsers([]); setGroupChatName('')}} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
              </div>
              <input
                type="text"
                placeholder="Group Chat Name"
                className="input-field"
                value={groupChatName}
                onChange={(e) => setGroupChatName(e.target.value)}
              />
              <input
                type="text"
                placeholder="Add Users eg: John, Jane"
                className="input-field"
                onChange={(e) => handleSearch(e.target.value)}
              />
              
              {/* Selected Users */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
                {selectedUsers.map(u => (
                  <div key={u._id} style={{ background: 'var(--primary-gradient)', padding: '5px 10px', borderRadius: '15px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {u.name} <span style={{ cursor: 'pointer' }} onClick={() => handleGroupRemove(u)}>&times;</span>
                  </div>
                ))}
              </div>

              {/* Search Results */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '150px', overflowY: 'auto', marginBottom: '20px' }}>
                {searchResult?.slice(0,4).map(resUser => (
                  <div key={resUser._id} onClick={() => handleGroupAdd(resUser)} style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <img src={resUser.pic} alt={resUser.name} style={{ width: '30px', height: '30px', borderRadius: '50%' }} />
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{resUser.name}</div>
                  </div>
                ))}
              </div>
              
              <button className="btn-primary" onClick={handleSubmitGroup}>Create Chat</button>
            </div>
          )}

          {/* Group Info Modal */}
          {isGroupInfoModalOpen && selectedChat && (
            <div className="glass-panel" style={{ width: '600px', padding: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', maxHeight: '85vh' }}>
              <button onClick={() => setIsGroupInfoModalOpen(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', justifyContent: 'center', marginBottom: '15px' }}>
                {!isRenamingGroup ? (
                  <>
                    <h2 style={{ margin: 0, fontWeight: '600', maxWidth: '80%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedChat.chatName}</h2>
                    { (selectedChat.groupAdmin?._id === user._id || selectedChat.coAdmins?.some(a => a._id === user._id)) && (
                      <span style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '5px' }} onClick={() => { setIsRenamingGroup(true); setNewGroupName(selectedChat.chatName); }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="gray" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                      </span>
                    )}
                  </>
                ) : (
                  <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                    <input
                      type="text"
                      className="input-field"
                      style={{ marginBottom: 0, flex: 1 }}
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      autoFocus
                    />
                    <button className="btn-primary" onClick={handleRenameGroup} disabled={renameLoading} style={{ padding: '5px 10px', minWidth: '70px' }}>
                      {renameLoading ? '...' : 'Save'}
                    </button>
                    <button className="btn-outline" onClick={() => setIsRenamingGroup(false)} style={{ padding: '5px 10px' }}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '25px' }}>Created on {new Date(selectedChat.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</div>
              
              <div style={{ position: 'relative', marginBottom: '20px' }}>
                <img 
                  src={getAvatar(selectedChat)} 
                  alt="Group Avatar" 
                  style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)', padding: '3px', background: 'rgba(255,255,255,0.05)', cursor: 'pointer' }} 
                  onClick={() => setEnlargedImage(getAvatar(selectedChat))}
                />
                { (selectedChat.groupAdmin?._id === user._id || selectedChat.coAdmins?.some(a => a._id === user._id)) && (
                  <label htmlFor="group-pic-upload" style={{
                    position: 'absolute', bottom: '0', right: '0',
                    background: 'var(--surface-color)', width: '35px', height: '35px',
                    borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center',
                    cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', transition: 'transform 0.2s', border: '1px solid gray'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="gray" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                  </label>
                )}
                <input type="file" id="group-pic-upload" style={{ display: 'none' }} accept="image/*" onChange={updateGroupPicture} />
                {groupPicUploading && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.5)', padding: '5px', borderRadius: '5px', fontSize: '0.8rem', color: 'white', whiteSpace: 'nowrap' }}>Uploading...</div>}
              </div>

              { (selectedChat.groupAdmin?._id === user._id || selectedChat.coAdmins?.some(a => a._id === user._id)) && showAddGroupMember && (
                <div style={{ width: '100%', marginBottom: '20px', background: 'var(--surface-color)', padding: '15px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h4 style={{ margin: 0 }}>Add New Members</h4>
                    <span style={{ cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-secondary)' }} onClick={() => setShowAddGroupMember(false)}>&times;</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Search users to add..."
                    className="input-field"
                    onChange={(e) => handleSearch(e.target.value)}
                    style={{ marginBottom: '10px' }}
                  />
                  {loading ? (
                    <div style={{ textAlign: 'center' }}>Loading...</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '120px', overflowY: 'auto' }}>
                      {searchResult.slice(0, 4).map(resUser => (
                        <div key={resUser._id} onClick={() => { handleAddUserToGroup(resUser); setShowAddGroupMember(false); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 10px', background: 'var(--surface-color)', borderRadius: '8px', cursor: 'pointer' }}>
                          <img src={(!resUser.pic || resUser.pic === 'https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg') ? defaultSingleAvatar : resUser.pic} style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }} />
                          <span>{resUser.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '5px 0' }} onClick={() => setShowGroupMembers(!showGroupMembers)}>
                  <h4 style={{ margin: '0', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    Members ({selectedChat.users.length}) <span style={{ fontSize: '0.8rem' }}>{showGroupMembers ? '▼' : '▶'}</span>
                  </h4>
                  { (selectedChat.groupAdmin?._id === user._id || selectedChat.coAdmins?.some(a => a._id === user._id)) && !showAddGroupMember && (
                    <button onClick={(e) => { e.stopPropagation(); setShowAddGroupMember(true); }} style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '50%', width: '25px', height: '25px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', fontSize: '1.2rem', lineHeight: '1' }}>+</button>
                  )}
                </div>

                {showGroupMembers && (
                  <>
                    <input 
                      type="text" 
                      placeholder="🔍 Search members..." 
                      className="input-field" 
                      style={{ padding: '8px 15px', fontSize: '0.85rem', marginBottom: '5px' }}
                      value={groupMembersSearch}
                      onChange={(e) => setGroupMembersSearch(e.target.value)}
                    />
                    {[...selectedChat.users]
                      .sort((a, b) => {
                        const isACreator = selectedChat.groupAdmin?._id === a._id;
                        const isBCreator = selectedChat.groupAdmin?._id === b._id;
                        if (isACreator) return -1;
                        if (isBCreator) return 1;
                        const isACoAdmin = selectedChat.coAdmins?.some(admin => admin._id === a._id);
                        const isBCoAdmin = selectedChat.coAdmins?.some(admin => admin._id === b._id);
                        if (isACoAdmin && !isBCoAdmin) return -1;
                        if (!isACoAdmin && isBCoAdmin) return 1;
                        return 0;
                      })
                      .filter(u => u.name.toLowerCase().includes(groupMembersSearch.toLowerCase()))
                      .map(u => {
                        const isCreator = selectedChat.groupAdmin?._id === u._id;
                        const isCoAdmin = selectedChat.coAdmins?.some(a => a._id === u._id);
                        const isCurrentUserAdmin = selectedChat.groupAdmin?._id === user._id || selectedChat.coAdmins?.some(a => a._id === user._id);
                        
                        return (
                        <div key={u._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'var(--surface-color)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1 }} onClick={() => { setModalUser(u); setIsUserInfoModalOpen(true); setIsGroupInfoModalOpen(false); }}>
                            <img 
                              src={(!u.pic || u.pic === 'https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg') ? defaultSingleAvatar : u.pic} 
                              style={{ width: '35px', height: '35px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }} 
                              onClick={(e) => { e.stopPropagation(); setEnlargedImage((!u.pic || u.pic === 'https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg') ? defaultSingleAvatar : u.pic); }} 
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.95rem' }}>
                                {u.name} 
                                {isCreator && <span style={{ color: 'var(--primary)', fontSize: '0.75rem', marginLeft: '5px' }}>(Creator)</span>}
                                {isCoAdmin && <span style={{ color: 'gray', fontSize: '0.75rem', marginLeft: '5px' }}>(Admin)</span>}
                              </span>
                            </div>
                          </div>
                          
                          {isCurrentUserAdmin && u._id !== user._id && (
                            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                              {!isCreator && !isCoAdmin && (
                                <button onClick={() => handleMakeAdmin(u)} style={{ background: 'transparent', border: '1px solid gray', color: 'gray', borderRadius: '4px', fontSize: '0.7rem', padding: '2px 5px', cursor: 'pointer' }}>Make Admin</button>
                              )}
                              {isCoAdmin && (
                                <button onClick={() => handleRemoveAdmin(u)} style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '4px', fontSize: '0.7rem', padding: '2px 5px', cursor: 'pointer' }}>Demote</button>
                              )}
                              {!isCreator && (
                                <button onClick={() => handleRemoveUserFromGroup(u)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.5rem', padding: '0 5px' }}>&times;</button>
                              )}
                            </div>
                          )}
                        </div>
                      )})}
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '20px' }}>
                <button className="btn-outline" style={{ flex: 1, color: '#ef4444', borderColor: '#ef4444' }} onClick={() => {
                  if(window.confirm('Are you sure you want to leave this group?')) {
                    handleRemoveUserFromGroup(user);
                    setIsGroupInfoModalOpen(false);
                  }
                }}>
                  Leave Group
                </button>
              </div>

              { (selectedChat.groupAdmin?._id === user._id || selectedChat.coAdmins?.some(a => a._id === user._id)) && selectedChat.pendingEmails?.filter(pe => pe.status === 'pending').length > 0 && (
                <div style={{ width: '100%', marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-secondary)' }}>Pending Email Requests</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto', paddingRight: '5px' }}>
                    {selectedChat.pendingEmails.filter(pe => pe.status === 'pending').map(email => (
                      <div key={email._id} style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginBottom: '5px' }}>From: {email.sender?.name || 'A Member'}</div>
                        <div style={{ fontWeight: 'bold', marginBottom: '5px', wordBreak: 'break-word' }}>{email.subject}</div>
                        <div style={{ fontSize: '0.9rem', marginBottom: '10px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '100px', overflowY: 'auto' }}>{email.message}</div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button className="btn-primary" style={{ flex: 1, padding: '5px' }} onClick={() => handleApproveEmail(email._id)}>Approve</button>
                          <button className="btn-outline" style={{ flex: 1, padding: '5px', color: '#ef4444', borderColor: '#ef4444' }} onClick={() => handleRejectEmail(email._id)}>Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* User Info Modal */}
          {isUserInfoModalOpen && modalUser && (
            <div className="glass-panel" style={{ width: '450px', padding: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              <button onClick={() => { setIsUserInfoModalOpen(false); setModalUser(null); }} style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
              
              <div style={{ marginBottom: '20px' }}>
                <img 
                  src={(!modalUser.pic || modalUser.pic === 'https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg') ? defaultSingleAvatar : modalUser.pic} 
                  alt="Profile Avatar" 
                  style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)', padding: '3px', background: 'rgba(255,255,255,0.05)', cursor: 'pointer' }} 
                  onClick={() => setEnlargedImage((!modalUser.pic || modalUser.pic === 'https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg') ? defaultSingleAvatar : modalUser.pic)}
                />
              </div>

              <h2 style={{ margin: '0 0 5px 0', fontWeight: '600', textAlign: 'center' }}>{modalUser.name}</h2>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '15px' }}>{modalUser.email}</div>

              {(() => {
                const existingChat = chats.find(c => !c.isGroupChat && c.users.find(u => u._id === modalUser._id));
                if (existingChat) {
                  return <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '20px', fontStyle: 'italic' }}>Started chatting on {new Date(existingChat.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</div>;
                }
                return null;
              })()}

              {user._id !== modalUser._id && (
                <button 
                  className="btn-primary" 
                  style={{ padding: '10px 20px', width: '100%', borderRadius: '12px' }}
                  onClick={() => {
                    setIsUserInfoModalOpen(false);
                    accessChat(modalUser._id);
                  }}
                >
                  Start Chat
                </button>
              )}
            </div>
          )}

          {/* Profile Modal */}
          {isProfileModalOpen && (
            <div className="glass-panel" style={{ width: '500px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', marginBottom: '10px' }}>
                <button onClick={() => setIsProfileModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
              </div>
              <h2 style={{ margin: '0 0 20px 0' }}>Profile</h2>
              <div style={{ position: 'relative', marginBottom: '20px' }}>
                <img 
                  src={(!profilePicUrl || profilePicUrl === 'https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg') ? defaultSingleAvatar : profilePicUrl} 
                  alt={profileName} 
                  style={{ width: '150px', height: '150px', borderRadius: '50%', objectFit: 'cover', opacity: picUploading ? 0.5 : 1, cursor: 'pointer' }} 
                  onClick={() => setEnlargedImage((!profilePicUrl || profilePicUrl === 'https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg') ? defaultSingleAvatar : profilePicUrl)}
                />
                <label style={{ 
                  position: 'absolute', bottom: '5px', right: '5px', 
                  background: 'var(--primary-gradient)', padding: '10px', 
                  borderRadius: '50%', cursor: 'pointer', 
                  display: 'flex', justifyContent: 'center', alignItems: 'center',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.2)' 
                }}>
                  📷
                  <input type="file" style={{ display: 'none' }} accept="image/*" onChange={handleProfilePicUpload} disabled={picUploading} />
                </label>
              </div>
              
              <div style={{ width: '100%', marginBottom: '15px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '5px' }}>Name</label>
                <input
                  type="text"
                  placeholder="Name"
                  className="input-field"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  style={{ marginTop: '5px', width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ width: '100%', marginBottom: '15px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '5px' }}>Email</label>
                <div style={{ 
                  background: 'var(--surface-color)', 
                  padding: '12px 15px', 
                  borderRadius: '8px', 
                  marginTop: '5px',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  border: '1px solid var(--border-color)'
                }}>
                  {user?.email}
                </div>
              </div>

              <div style={{ width: '100%', marginBottom: '25px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '5px' }}>Mobile Number</label>
                <div style={{ 
                  background: 'var(--surface-color)', 
                  padding: '12px 15px', 
                  borderRadius: '8px', 
                  marginTop: '5px',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  border: '1px solid var(--border-color)'
                }}>
                  {user?.mobile || 'Not provided'}
                </div>
              </div>
              
              <button className="btn-primary" onClick={handleUpdateProfile} disabled={profileUpdating} style={{ width: '100%' }}>
                {profileUpdating ? 'Updating...' : 'Update Profile'}
              </button>

              <button 
                onClick={async () => {
                  if (window.confirm("Are you sure you want to permanently delete your account? This action cannot be undone.")) {
                    try {
                      await axios.delete('http://localhost:5000/api/user/delete', { headers: { Authorization: `Bearer ${user.token}` } });
                      let accounts = JSON.parse(localStorage.getItem('userAccounts')) || [];
                      accounts = accounts.filter(acc => acc._id !== user._id);
                      localStorage.setItem('userAccounts', JSON.stringify(accounts));
                      localStorage.removeItem('userInfo');
                      window.location.href = '/';
                    } catch (error) {
                      alert("Failed to delete account");
                    }
                  }
                }}
                className="btn-outline" 
                style={{ width: '100%', marginTop: '15px', color: '#ef4444', borderColor: '#ef4444' }}
              >
                Delete Account
              </button>
            </div>
          )}

          {/* Email Modal */}
          {isEmailModalOpen && (
            <div className="glass-panel" style={{ width: '400px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ margin: 0 }}>Send Email</h3>
                <button onClick={() => { setIsEmailModalOpen(false); setEmailSubject(''); setEmailMessage(''); }} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
              </div>
              
              <div style={{ marginBottom: '15px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                To: {!selectedChat?.isGroupChat ? (selectedChat?.users[0]._id === user._id ? selectedChat?.users[1]?.name : selectedChat?.users[0]?.name) : ''}
              </div>

              <input
                type="text"
                placeholder="Subject"
                className="input-field"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
              <textarea
                placeholder="Write your email here..."
                className="input-field"
                style={{ minHeight: '150px', resize: 'vertical' }}
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
              />
              
              <button className="btn-primary" onClick={handleSendEmail} disabled={emailSending}>
                {emailSending ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          )}

          {/* Video Call Modal */}
          {isVideoModalOpen && (
            <div className="glass-panel" style={{ width: '80vw', height: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 20px', background: 'rgba(0,0,0,0.5)', alignItems: 'center' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>🎥 Video Call</h3>
                <button onClick={() => setIsVideoModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.5rem', width: '30px', height: '30px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '50%' }} onMouseEnter={(e) => e.target.style.background='rgba(255,255,255,0.1)'} onMouseLeave={(e) => e.target.style.background='transparent'}>&times;</button>
              </div>
              <div style={{ flex: 1, background: '#000' }}>
                <iframe
                  src={`https://meet.jit.si/${videoRoomId}`}
                  allow="camera; microphone; fullscreen; display-capture"
                  style={{ width: '100%', height: '100%', border: 'none' }}
                ></iframe>
              </div>
            </div>
          )}

          {/* Settings Modal */}
          {isSettingsModalOpen && (
            <div className="glass-panel" style={{ width: '400px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ margin: 0 }}>Settings</h3>
                <button onClick={() => setIsSettingsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Base Theme</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setBaseTheme('dark')} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: baseTheme === 'dark' ? '2px solid var(--primary)' : '1px solid var(--border-color)', background: '#0b0f19', color: 'white', cursor: 'pointer' }}>Dark</button>
                  <button onClick={() => setBaseTheme('light')} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: baseTheme === 'light' ? '2px solid var(--primary)' : '1px solid var(--border-color)', background: '#f8fafc', color: 'black', cursor: 'pointer' }}>Light</button>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Accent Color</label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-start', alignItems: 'center' }}>
                  <div onClick={() => setAccentColor('default')} title="Default Theme" style={{ width: '50px', height: '40px', borderRadius: '20px', background: 'linear-gradient(135deg, #312e81 0%, #6366f1 100%)', cursor: 'pointer', border: accentColor === 'default' ? '2px solid white' : 'none', boxShadow: accentColor === 'default' ? '0 0 0 2px var(--primary)' : 'none', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontSize: '0.7rem', fontWeight: 'bold' }}>Def</div>
                  <div onClick={() => setAccentColor('blue')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)', cursor: 'pointer', border: accentColor === 'blue' ? '2px solid white' : 'none', boxShadow: accentColor === 'blue' ? '0 0 0 2px #3b82f6' : 'none', flexShrink: 0 }}></div>
                  <div onClick={() => setAccentColor('green')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)', cursor: 'pointer', border: accentColor === 'green' ? '2px solid white' : 'none', boxShadow: accentColor === 'green' ? '0 0 0 2px #10b981' : 'none', flexShrink: 0 }}></div>
                  <div onClick={() => setAccentColor('orange')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #fbbf24 0%, #f97316 100%)', cursor: 'pointer', border: accentColor === 'orange' ? '2px solid white' : 'none', boxShadow: accentColor === 'orange' ? '0 0 0 2px #f97316' : 'none', flexShrink: 0 }}></div>
                  <div onClick={() => setAccentColor('purple')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #d946ef 0%, #a855f7 100%)', cursor: 'pointer', border: accentColor === 'purple' ? '2px solid white' : 'none', boxShadow: accentColor === 'purple' ? '0 0 0 2px #a855f7' : 'none', flexShrink: 0 }}></div>
                  <div onClick={() => setAccentColor('red')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #f43f5e 0%, #ef4444 100%)', cursor: 'pointer', border: accentColor === 'red' ? '2px solid white' : 'none', boxShadow: accentColor === 'red' ? '0 0 0 2px #ef4444' : 'none', flexShrink: 0 }}></div>
                  <div onClick={() => setAccentColor('teal')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #2dd4bf 0%, #14b8a6 100%)', cursor: 'pointer', border: accentColor === 'teal' ? '2px solid white' : 'none', boxShadow: accentColor === 'teal' ? '0 0 0 2px #14b8a6' : 'none', flexShrink: 0 }}></div>
                  <div onClick={() => setAccentColor('monochrome')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #334155 0%, #94a3b8 100%)', cursor: 'pointer', border: accentColor === 'monochrome' ? '2px solid white' : 'none', boxShadow: accentColor === 'monochrome' ? '0 0 0 2px #94a3b8' : 'none', flexShrink: 0 }}></div>
                  <div onClick={() => setAccentColor('midnight')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)', cursor: 'pointer', border: accentColor === 'midnight' ? '2px solid white' : 'none', boxShadow: accentColor === 'midnight' ? '0 0 0 2px #4338ca' : 'none', flexShrink: 0 }}></div>
                  <div onClick={() => setAccentColor('forest')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #064e3b 0%, #10b981 100%)', cursor: 'pointer', border: accentColor === 'forest' ? '2px solid white' : 'none', boxShadow: accentColor === 'forest' ? '0 0 0 2px #10b981' : 'none', flexShrink: 0 }}></div>
                  <div onClick={() => setAccentColor('sunset')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #f43f5e 0%, #fb923c 100%)', cursor: 'pointer', border: accentColor === 'sunset' ? '2px solid white' : 'none', boxShadow: accentColor === 'sunset' ? '0 0 0 2px #fb923c' : 'none', flexShrink: 0 }}></div>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Background Pattern</label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {['doodles', 'dots', 'waves', 'grid', 'lines', 'hex', 'zigzag', 'abstract', 'stone', 'bark', 'circuit', 'coral', 'mosaic', 'boxes', 'none'].map(p => (
                    <button key={p} onClick={() => setPanelPattern(p)} style={{ flex: '1 1 auto', padding: '8px 12px', borderRadius: '8px', border: panelPattern === p ? '2px solid var(--primary)' : '1px solid var(--border-color)', background: panelPattern === p ? 'rgba(255,255,255,0.1)' : 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', textTransform: 'capitalize' }}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Press Enter to Send</label>
                <button 
                  onClick={() => setEnterToSend(!enterToSend)}
                  style={{ 
                    width: '50px', height: '26px', borderRadius: '13px', 
                    background: enterToSend ? 'var(--primary-gradient)' : 'rgba(255,255,255,0.1)', 
                    border: 'none', position: 'relative', cursor: 'pointer',
                    transition: 'background 0.3s'
                  }}
                >
                  <div style={{ 
                    width: '22px', height: '22px', background: 'white', borderRadius: '50%',
                    position: 'absolute', top: '2px', left: enterToSend ? '26px' : '2px',
                    transition: 'left 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}></div>
                </button>
              </div>

            </div>
          )}

        </div>
      )}

      {/* Schedule Message Modal */}
      {isScheduleModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1500 }}>
          <div className="glass-panel" style={{ width: '400px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Schedule Message</h3>
              <button onClick={() => {setIsScheduleModalOpen(false); setScheduledMessageContent(''); setScheduledDate(''); setScheduledTime(''); setSchedulingChatId(null);}} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
            </div>
            <textarea
              placeholder="Type your message here..."
              className="input-field"
              value={scheduledMessageContent}
              onChange={(e) => setScheduledMessageContent(e.target.value)}
              style={{ minHeight: '100px', resize: 'vertical', marginBottom: '15px' }}
            />
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  style={{ marginBottom: 0 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Time</label>
                <input
                  type="time"
                  className="input-field"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  style={{ marginBottom: 0 }}
                />
              </div>
            </div>
            <button className="btn-primary" onClick={handleScheduleSubmit}>Schedule</button>
          </div>
        </div>
      )}

      {/* Self Destruct Modal */}
      {isSelfDestructModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1500 }}>
          <div className="glass-panel" style={{ width: '350px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Self-Destruct Timer</h3>
              <button onClick={() => {setIsSelfDestructModalOpen(false); setSelfDestructTimer(null); setSelfDestructChatId(null);}} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '15px' }}>
              New messages in this chat will be deleted automatically after the selected time.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '250px', overflowY: 'auto', marginBottom: '20px' }}>
              {[
                { label: 'Off', value: 0 },
                { label: '1 minute', value: 60 * 1000 },
                { label: '5 minutes', value: 5 * 60 * 1000 },
                { label: '30 minutes', value: 30 * 60 * 1000 },
                { label: '1 hour', value: 60 * 60 * 1000 },
                { label: '12 hours', value: 12 * 60 * 60 * 1000 },
                { label: '1 day', value: 24 * 60 * 60 * 1000 },
                { label: '1 month', value: 30 * 24 * 60 * 60 * 1000 },
                { label: '6 months', value: 6 * 30 * 24 * 60 * 60 * 1000 },
                { label: '1 year', value: 365 * 24 * 60 * 60 * 1000 },
              ].map(opt => (
                <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="selfDestructTimer" 
                    value={opt.value} 
                    checked={selfDestructTimer === opt.value || (selfDestructTimer === null && opt.value === 0)}
                    onChange={() => setSelfDestructTimer(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <button className="btn-primary" onClick={handleSetSelfDestructSubmit}>Save Timer</button>
          </div>
        </div>
      )}

      {/* Summary Modal */}
      {isSummaryModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1500 }}>
          <div className="glass-panel" style={{ width: '400px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#a78bfa' }}>✨</span> AI Summary
              </h3>
              <button onClick={() => {setIsSummaryModalOpen(false); setSummaryContent('');}} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
            </div>
            
            <div style={{ 
              minHeight: '100px', 
              maxHeight: '300px', 
              overflowY: 'auto', 
              background: 'rgba(0,0,0,0.2)', 
              padding: '15px', 
              borderRadius: '8px',
              fontSize: '0.9rem',
              lineHeight: '1.5'
            }}>
              {isSummarizing ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100px', color: '#a78bfa', fontStyle: 'italic' }}>
                  Analyzing message...
                </div>
              ) : (
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  {summaryContent}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Accounts Modal */}
      {isAccountsModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1600 }}>
          <div className="glass-panel" style={{ width: '400px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Switch Account</h3>
              <button onClick={() => setIsAccountsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
              {(JSON.parse(localStorage.getItem('userAccounts')) || []).map(acc => (
                <div 
                  key={acc._id}
                  onClick={() => {
                    localStorage.setItem('userInfo', JSON.stringify(acc));
                    window.location.href = '/chat';
                  }}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', 
                    background: acc._id === user._id ? 'rgba(255,255,255,0.1)' : 'transparent',
                    border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer' 
                  }}
                >
                  <img src={(!acc.pic || acc.pic === 'https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg') ? defaultSingleAvatar : acc.pic} alt="avatar" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold' }}>{acc.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{acc.email}</div>
                  </div>
                  {acc._id === user._id && <span style={{ color: 'var(--primary)', fontSize: '0.85rem' }}>Active</span>}
                </div>
              ))}
            </div>
            <button 
              onClick={() => window.location.href = '/?action=add_account'} 
              className="btn-outline" style={{ width: '100%', marginTop: '20px' }}
            >
              + Add Another Account
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default ChatPage;
