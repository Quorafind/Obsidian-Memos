import React, {useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import appContext from '../stores/appContext';
import {globalStateService, locationService, memoService, resourceService} from '../services';
import utils from '../helpers/utils';
import {storage} from '../helpers/storage';
import Editor, {EditorRefActions} from './Editor/Editor';
import '../less/memo-editor.less';
import '../less/select-date-picker.less';
import tag from '../icons/tag.svg';
import imageSvg from '../icons/image.svg';
import taskSvg from '../icons/task.svg';
import showEditorSvg from '../icons/show-editor.svg';
import journalSvg from '../icons/journal.svg';
import {DayPicker} from 'react-day-picker';
import {usePopper} from 'react-popper';
// import { createPopper } from '@popperjs/core'
// import { format, isValid, parse } from 'date-fns';
import FocusTrap from 'focus-trap-react';
import {moment} from 'obsidian';
import {DefaultEditorLocation, DefaultPrefix, InsertDateFormat, UseButtonToShowEditor} from '../memos';
import useToggle from '../hooks/useToggle';
// import dailyNotesService from '../services/dailyNotesService';
// import { TagsSuggest } from "../obComponents/obTagSuggester";
import {Notice, Platform} from 'obsidian';

const getCursorPostion = (input: HTMLTextAreaElement) => {
  const {
    offsetLeft: inputX,
    offsetTop: inputY,
    offsetHeight: inputH,
    offsetWidth: inputW,
    selectionEnd: selectionPoint,
  } = input;
  const div = document.createElement('div');

  const copyStyle = window.getComputedStyle(input);
  for (const item of copyStyle) {
    div.style.setProperty(item, copyStyle.getPropertyValue(item));
  }
  div.style.position = 'fixed';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';

  // we need a character that will replace whitespace when filling our dummy element if it's a single line <input/>
  const swap = '.';
  const inputValue = input.tagName === 'INPUT' ? input.value.replace(/ /g, swap) : input.value;
  const textContent = inputValue.substring(0, selectionPoint || 0);
  div.textContent = textContent;
  if (input.tagName === 'TEXTAREA') {
    div.style.height = 'auto';
  }

  const span = document.createElement('span');
  span.textContent = inputValue.substring(selectionPoint || 0) || '.';
  div.appendChild(span);
  document.body.appendChild(div);
  const {offsetLeft: spanX, offsetTop: spanY, offsetHeight: spanH, offsetWidth: spanW} = span;
  document.body.removeChild(div);
  return {
    x: inputX + spanX,
    y: inputY + spanY,
    h: inputH + spanH,
    w: inputW + spanW,
  };
};

interface Props {}

let isList: boolean;
let isEditor = false as boolean;
let isEditorGo = true as boolean;
let positionX: number;

const MemoEditor: React.FC<Props> = () => {
  const {globalState} = useContext(appContext);
  const [isListShown, toggleList] = useToggle(false);
  const [isEditorShown, toggleEditor] = useToggle(false);
  const editorRef = useRef<EditorRefActions>(null);
  const prevGlobalStateRef = useRef(globalState);
  const [selected, setSelected] = useState<Date>();
  const [isPopperOpen, setIsPopperOpen] = useState(false);

  const popperRef = useRef<HTMLDivElement>(null);
  const [popperElement, setPopperElement] = useState(null);
  let popper;

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    if (DefaultPrefix === 'List') {
      isList = false;
      toggleList(false);
    } else {
      isList = true;
      toggleList(true);
    }

    // editorRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    if (Platform.isMobile !== true || window.innerWidth > 875) {
      handleShowEditor();
    }
    editorRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    if (
      UseButtonToShowEditor === true &&
      DefaultEditorLocation === 'Bottom' &&
      Platform.isMobile === true &&
      window.innerWidth < 875
    ) {
      const divThis = document.createElement('img');
      const memoEditorDiv = document.querySelector(
        "div[data-type='memos_view'] .view-content .memo-editor-wrapper",
      ) as HTMLElement;
      divThis.src = `${showEditorSvg}`;
      if (isEditorShown) {
        divThis.className = 'memo-show-editor-button hidden';
      } else {
        divThis.className = 'memo-show-editor-button';
      }
      const buttonTop = window.innerHeight - 200;
      const buttonLeft = window.innerWidth / 2 - 25;
      divThis.style.top = buttonTop + 'px';
      divThis.style.left = buttonLeft + 'px';

      divThis.onclick = function () {
        let scaleElementAni = divThis.animate(
          [
            // keyframes
            {transform: 'rotate(0deg) scale(1)'},
            {transform: 'rotate(60deg) scale(1.5)'},
          ],
          {
            // timing options
            duration: 300,
            iterations: Infinity,
          },
        );

        setTimeout(() => {
          divThis.className = 'memo-show-editor-button hidden';
          handleShowEditor(true);
          editorRef.current?.focus();
          scaleElementAni.reverse();
          // rotateElementAni.pause();
        }, 300);
      };
      document.querySelector("div[data-type='memos_view'] .view-content .content-wrapper").prepend(divThis);

      const memolistScroll = document.querySelector(
        "div[data-type='memos_view'] .view-content .memolist-wrapper",
      ) as HTMLElement;
      memolistScroll.onscroll = function () {
        if (isEditor && isEditorGo) {
          isEditorGo = false;
          let scaleEditorElementAni = memoEditorDiv.animate(
            [
              // keyframes
              {transform: 'scale(1)', opacity: 1},
              {transform: 'scale(0.4)', opacity: 0},
            ],
            {
              // timing options
              duration: 300,
              iterations: 1,
            },
          );
          let scaleOneElementAni: Animation;
          setTimeout(() => {
            scaleOneElementAni = divThis.animate(
              [
                // keyframes
                {transform: 'rotate(20deg) scale(1.5)'},
                {transform: 'rotate(0deg) scale(1)'},
              ],
              {
                // timing options
                duration: 100,
                iterations: 1,
              },
            );
          }, 300);
          setTimeout(() => {
            handleShowEditor(false);
            divThis.className = 'memo-show-editor-button';
          }, 300);
          setTimeout(() => {
            scaleOneElementAni.cancel();
            scaleEditorElementAni.reverse();
          }, 700);
        }
      };
    } else if (
      UseButtonToShowEditor === false &&
      DefaultEditorLocation === 'Bottom' &&
      Platform.isMobile === true &&
      window.innerWidth < 875
    ) {
      handleShowEditor(true);
      editorRef.current?.focus();
    } else {
      handleShowEditor(true);
      editorRef.current?.focus();
    }
  }, []);

  if (!Platform.isMobile) {
    popper = usePopper(popperRef.current, popperElement, {
      placement: 'right-end',
      modifiers: [
        {
          name: 'flip',
          options: {
            allowedAutoPlacements: ['bottom'],
            rootBoundary: 'document', // by default, all the placements are allowed
          },
        },
      ],
    });
  } else if (Platform.isMobile && DefaultEditorLocation !== 'Bottom') {
    const seletorPopupWidth = 280;
    if (window.innerWidth - positionX > seletorPopupWidth * 1.2) {
      popper = usePopper(popperRef.current, popperElement, {
        placement: 'right-end',
        modifiers: [
          {
            name: 'flip',
            options: {
              allowedAutoPlacements: ['left-end'],
              rootBoundary: 'document', // by default, all the placements are allowed
            },
          },
          {
            name: 'preventOverflow',
            options: {
              rootBoundary: 'document',
            },
          },
        ],
      });
    } else if (window.innerWidth - positionX < seletorPopupWidth) {
      popper = usePopper(popperRef.current, popperElement, {
        placement: 'left-end',
        modifiers: [
          {
            name: 'flip',
            options: {
              allowedAutoPlacements: ['right-end'],
              rootBoundary: 'document', // by default, all the placements are allowed
            },
          },
          {
            name: 'preventOverflow',
            options: {
              rootBoundary: 'document',
            },
          },
        ],
      });
    } else {
      popper = usePopper(popperRef.current, popperElement, {
        placement: 'bottom',
        modifiers: [
          {
            name: 'flip',
            options: {
              allowedAutoPlacements: ['bottom'],
              rootBoundary: 'document', // by default, all the placements are allowed
            },
          },
          {
            name: 'preventOverflow',
            options: {
              rootBoundary: 'document',
            },
          },
        ],
      });
    }
  } else if (Platform.isMobile && DefaultEditorLocation === 'Bottom') {
    const seletorPopupWidth = 280;
    if (window.innerWidth - positionX > seletorPopupWidth * 1.2) {
      popper = usePopper(popperRef.current, popperElement, {
        placement: 'top-end',
        modifiers: [
          {
            name: 'flip',
            options: {
              allowedAutoPlacements: ['top-start'],
              rootBoundary: 'document', // by default, all the placements are allowed
            },
          },
          {
            name: 'preventOverflow',
            options: {
              rootBoundary: 'document',
            },
          },
        ],
      });
    } else if (window.innerWidth - positionX < seletorPopupWidth && positionX > seletorPopupWidth) {
      popper = usePopper(popperRef.current, popperElement, {
        placement: 'top-start',
        modifiers: [
          {
            name: 'flip',
            options: {
              allowedAutoPlacements: ['top-end'],
              rootBoundary: 'document', // by default, all the placements are allowed
            },
          },
          {
            name: 'preventOverflow',
            options: {
              rootBoundary: 'document',
            },
          },
        ],
      });
    } else {
      popper = usePopper(popperRef.current, popperElement, {
        placement: 'top',
        modifiers: [
          {
            name: 'flip',
            options: {
              allowedAutoPlacements: ['top'],
              rootBoundary: 'document', // by default, all the placements are allowed
            },
          },
          {
            name: 'preventOverflow',
            options: {
              rootBoundary: 'document',
            },
          },
        ],
      });
    }
    // popper = usePopper(popperRef.current, popperElement, {
    //   placement: 'top',
    //   modifiers: [
    //     {
    //       name: 'flip',
    //       options: {
    //         allowedAutoPlacements: ['top'],
    //         rootBoundary: 'document', // by default, all the placements are allowed
    //       },
    //     },
    //     {
    //       name: 'preventOverflow',
    //       options: {
    //         rootBoundary: 'document',
    //       },
    //     },
    //   ],
    // });
  }

  const closePopper = () => {
    setIsPopperOpen(false);
    // buttonRef?.current?.focus();
  };

  useEffect(() => {
    if (globalState.markMemoId) {
      const editorCurrentValue = editorRef.current?.getContent();
      const memoLinkText = `${editorCurrentValue ? '\n' : ''}Mark: [@MEMO](${globalState.markMemoId})`;
      editorRef.current?.insertText(memoLinkText);
      globalStateService.setMarkMemoId('');
    }

    if (globalState.editMemoId && globalState.editMemoId !== prevGlobalStateRef.current.editMemoId) {
      const editMemo = memoService.getMemoById(globalState.editMemoId);
      if (editMemo) {
        editorRef.current?.setContent(editMemo.content.replace(/\<br\>/g, '\n') ?? '');
        editorRef.current?.focus();
      }
    }

    prevGlobalStateRef.current = globalState;
  }, [globalState.markMemoId, globalState.editMemoId]);

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    // new TagsSuggest(app, editorRef.current.element);

    const handlePasteEvent = async (event: ClipboardEvent) => {
      if (event.clipboardData && event.clipboardData.files.length > 0) {
        event.preventDefault();
        const file = event.clipboardData.files[0];
        const url = await handleUploadFile(file);
        if (url) {
          editorRef.current?.insertText(url);
        }
      }
    };

    const handleDropEvent = async (event: DragEvent) => {
      if (event.dataTransfer && event.dataTransfer.files.length > 0) {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        const url = await handleUploadFile(file);
        if (url) {
          editorRef.current?.insertText(url);
        }
      }
    };

    const handleClickEvent = () => {
      handleContentChange(editorRef.current?.element.value ?? '');
    };

    const handleKeyDownEvent = () => {
      setTimeout(() => {
        handleContentChange(editorRef.current?.element.value ?? '');
      });
    };

    editorRef.current.element.addEventListener('paste', handlePasteEvent);
    editorRef.current.element.addEventListener('drop', handleDropEvent);
    editorRef.current.element.addEventListener('click', handleClickEvent);
    editorRef.current.element.addEventListener('keydown', handleKeyDownEvent);

    return () => {
      editorRef.current?.element.removeEventListener('paste', handlePasteEvent);
      editorRef.current?.element.removeEventListener('drop', handleDropEvent);
    };
  }, []);

  const handleUploadFile = useCallback(async (file: File) => {
    const {type} = file;

    if (!type.startsWith('image')) {
      return;
    }

    try {
      const image = await resourceService.upload(file);
      const url = `${image}`;

      return url;
    } catch (error: any) {
      new Notice(error);
    }
  }, []);

  const handleSaveBtnClick = useCallback(async (content: string) => {
    if (content === '') {
      new Notice('内容不能为空呀');
      return;
    }

    const {editMemoId} = globalStateService.getState();
    content = content.replaceAll('&nbsp;', ' ');

    setEditorContentCache('');
    try {
      if (editMemoId) {
        const prevMemo = memoService.getMemoById(editMemoId);
        if (prevMemo && prevMemo.content !== content) {
          const editedMemo = await memoService.updateMemo(prevMemo.id, prevMemo.content, content, prevMemo.memoType);
          editedMemo.updatedAt = utils.getDateTimeString(Date.now());
          memoService.editMemo(editedMemo);
        }
        globalStateService.setEditMemoId('');
      } else {
        const newMemo = await memoService.createMemo(content, isList);
        memoService.pushMemo(newMemo);
        // memoService.fetchAllMemos();
        locationService.clearQuery();
      }
    } catch (error: any) {
      new Notice(error.message);
    }

    setEditorContentCache('');
  }, []);

  const handleCancelBtnClick = useCallback(() => {
    globalStateService.setEditMemoId('');
    editorRef.current?.setContent('');
    setEditorContentCache('');
  }, []);

  const handleContentChange = useCallback((content: string) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    if (tempDiv.innerText.trim() === '') {
      content = '';
    }
    setEditorContentCache(content);

    if (editorRef.current) {
      const currentValue = editorRef.current.getContent();
      const selectionStart = editorRef.current.element.selectionStart;
      const prevString = currentValue.slice(0, selectionStart);
      const nextString = currentValue.slice(selectionStart);

      if ((prevString.endsWith('@') || prevString.endsWith('📆')) && nextString.startsWith(' ')) {
        updateDateSelectorPopupPosition();
        setIsPopperOpen(true);
      } else if ((prevString.endsWith('@') || prevString.endsWith('📆')) && nextString === '') {
        updateDateSelectorPopupPosition();
        setIsPopperOpen(true);
      } else {
        setIsPopperOpen(false);
      }

      setTimeout(() => {
        editorRef.current?.focus();
      });
    }
  }, []);

  const handleDateInsertTrigger = (date: Date) => {
    if (!editorRef.current) {
      return;
    }

    if (date) {
      closePopper();
      isList = true;
      toggleList(true);
    } else {
    }

    const currentValue = editorRef.current.getContent();
    const selectionStart = editorRef.current.element.selectionStart;
    const prevString = currentValue.slice(0, selectionStart);
    const nextString = currentValue.slice(selectionStart);
    const todayMoment = moment(date);

    if (!editorRef.current) {
      return;
    }

    if (prevString.endsWith('@')) {
      if (InsertDateFormat === 'Dataview') {
        editorRef.current.element.value =
          //eslint-disable-next-line
          currentValue.slice(0, editorRef.current.element.selectionStart - 1) +
          '[due::' +
          todayMoment.format('YYYY-MM-DD') +
          ']' +
          nextString;
        editorRef.current.element.setSelectionRange(selectionStart + 17, selectionStart + 17);
        editorRef.current.focus();
        handleContentChange(editorRef.current.element.value);
      } else if (InsertDateFormat === 'Tasks') {
        editorRef.current.element.value =
          //eslint-disable-next-line
          currentValue.slice(0, editorRef.current.element.selectionStart - 1) +
          '📆' +
          todayMoment.format('YYYY-MM-DD') +
          nextString;
        editorRef.current.element.setSelectionRange(selectionStart + 11, selectionStart + 11);
        editorRef.current.focus();
        handleContentChange(editorRef.current.element.value);
      }
    } else {
      editorRef.current.element.value =
        //eslint-disable-next-line
        prevString + todayMoment.format('YYYY-MM-DD') + nextString;
      editorRef.current.element.setSelectionRange(selectionStart + 10, selectionStart + 10);
      editorRef.current.focus();
      handleContentChange(editorRef.current.element.value);
    }
  };

  const handleChangeStatus = () => {
    if (!editorRef.current) {
      return;
    }

    if (isList) {
      isList = false;
      toggleList(false);
    } else {
      isList = true;
      toggleList(true);
    }
  };

  const handleShowEditor = (flag?: boolean) => {
    if (!editorRef.current) {
      return;
    }

    if (!isEditor || flag === true) {
      isEditor = true;
      toggleEditor(true);
    } else {
      isEditor = false;
      isEditorGo = true;
      toggleEditor(false);
    }
  };

  const handleTagTextBtnClick = useCallback(() => {
    if (!editorRef.current) {
      return;
    }

    const currentValue = editorRef.current.getContent();
    const selectionStart = editorRef.current.element.selectionStart;
    const prevString = currentValue.slice(0, selectionStart);
    const nextString = currentValue.slice(selectionStart);

    let nextValue = prevString + '# ' + nextString;
    let cursorIndex = prevString.length + 1;

    if (prevString.endsWith('#') && nextString.startsWith(' ')) {
      nextValue = prevString.slice(0, prevString.length - 1) + nextString.slice(1);
      cursorIndex = prevString.length - 1;
    }

    editorRef.current.element.value = nextValue;
    editorRef.current.element.setSelectionRange(cursorIndex, cursorIndex);
    editorRef.current.focus();
    handleContentChange(editorRef.current.element.value);
  }, []);

  const updateDateSelectorPopupPosition = useCallback(() => {
    if (!editorRef.current || !popperRef.current) {
      return;
    }

    const seletorPopupWidth = 280;
    const editorWidth = editorRef.current.element.clientWidth;

    // positionX = editorWidth;

    const {x, y} = getCursorPostion(editorRef.current.element);
    // const left = x + seletorPopupWidth + 16 > editorWidth ? editorWidth + 20 - seletorPopupWidth : x + 2;
    let left: number;
    let top: number;
    if (!Platform.isMobile) {
      left = x + seletorPopupWidth + 16 > editorWidth ? x + 2 : x + 2;
      top = y + 20;
    } else {
      if (window.innerWidth - x > seletorPopupWidth) {
        left = x + seletorPopupWidth + 16 > editorWidth ? x + 2 : x + 2;
      } else if (window.innerWidth - x < seletorPopupWidth) {
        left = x + seletorPopupWidth + 16 > editorWidth ? x + 18 : x + 18;
      } else {
        left = editorRef.current.element.clientWidth / 2;
      }
      if (DefaultEditorLocation === 'Bottom' && window.innerWidth > 875) {
        top = y + 20;
      } else if (DefaultEditorLocation === 'Bottom' && window.innerWidth <= 875) {
        top = y + 35;
      }
    }

    positionX = x;

    popperRef.current.style.left = `${left}px`;
    popperRef.current.style.top = `${top}px`;
  }, []);

  const handleUploadFileBtnClick = useCallback(() => {
    const inputEl = document.createElement('input');
    inputEl.type = 'file';
    inputEl.multiple = false;
    inputEl.accept = 'image/png, image/gif, image/jpeg';
    inputEl.onchange = async () => {
      if (!inputEl.files || inputEl.files.length === 0) {
        return;
      }

      const file = inputEl.files[0];
      const url = await handleUploadFile(file);
      if (url) {
        editorRef.current?.insertText(url);
      }
    };
    document.body.appendChild(inputEl);
    inputEl.click();
    document.body.removeChild(inputEl);
  }, []);

  const showEditStatus = Boolean(globalState.editMemoId);

  const editorConfig = useMemo(
    () => ({
      className: 'memo-editor',
      initialContent: getEditorContentCache(),
      placeholder: 'What do you think now...',
      showConfirmBtn: true,
      showCancelBtn: showEditStatus,
      showTools: true,
      onConfirmBtnClick: handleSaveBtnClick,
      onCancelBtnClick: handleCancelBtnClick,
      onContentChange: handleContentChange,
    }),
    [showEditStatus],
  );

  return (
    <div className={`memo-editor-wrapper ${showEditStatus ? 'edit-ing' : ''} ${isEditorShown ? '' : 'hidden'}`}>
      <p className={`tip-text ${showEditStatus ? '' : 'hidden'}`}>Modifying...</p>
      <Editor
        ref={editorRef}
        {...editorConfig}
        tools={
          <>
            <img className="action-btn add-tag" src={tag} onClick={handleTagTextBtnClick} />
            <img className="action-btn file-upload" src={imageSvg} onClick={handleUploadFileBtnClick} />
            <img
              className="action-btn list-or-task"
              src={`${!isListShown ? journalSvg : taskSvg}`}
              onClick={handleChangeStatus}
            />
            {/* <img className={`action-btn ${isListShown ? "" : "hidden"}`} src={taskSvg} onClick={handleChangeStatus} /> */}
          </>
        }
      />
      <div ref={popperRef} className="date-picker">
        {isPopperOpen && (
          <FocusTrap
            active
            focusTrapOptions={{
              initialFocus: false,
              allowOutsideClick: true,
              clickOutsideDeactivates: true,
              onDeactivate: closePopper,
            }}>
            <div
              tabIndex={-1}
              style={popper.styles.popper}
              {...popper.attributes.popper}
              ref={setPopperElement}
              role="dialog">
              <DayPicker
                initialFocus={isPopperOpen}
                mode="single"
                defaultMonth={selected}
                selected={selected}
                onSelect={handleDateInsertTrigger}
              />
            </div>
          </FocusTrap>
        )}
      </div>
    </div>
  );
};

function getEditorContentCache(): string {
  return storage.get(['editorContentCache']).editorContentCache ?? '';
}

function setEditorContentCache(content: string) {
  storage.set({
    editorContentCache: content,
  });
}

export default MemoEditor;
