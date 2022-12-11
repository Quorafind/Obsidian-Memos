import React, { useEffect, useRef, useState } from 'react';
// import { userService } from "../services";
import toImage from '../labs/html2image';
import {
  ANIMATION_DURATION,
  IMAGE_URL_REG,
  MARKDOWN_URL_REG,
  MARKDOWN_WEB_URL_REG,
  WIKI_IMAGE_URL_REG,
} from '../helpers/consts';
import utils from '../helpers/utils';
import { showDialog } from './Dialog';
import { formatMemoContent } from './Memo';
import Only from './common/OnlyWhen';
import '../less/share-memo-image-dialog.less';
import { moment, Notice, Platform, TFile, Vault } from 'obsidian';
import appStore from '../stores/appStore';
import {
  AutoSaveWhenOnMobile,
  DefaultDarkBackgroundImage,
  DefaultLightBackgroundImage,
  ShareFooterEnd,
  ShareFooterStart,
  UserName,
} from '../memos';
import lightBackground from '../icons/lightBackground.svg';
import darkBackground from '../icons/darkBackground.svg';

import { t } from '../translations/helper';
import { dailyNotesService } from '../services';
import Share from '../icons/share.svg?component';
import Close from '../icons/close.svg?component';

interface Props extends DialogProps {
  memo: Model.Memo;
}

interface LinkMatch {
  linkText: string;
  altText: string;
  path: string;
  filePath?: string;
}

export const getPathOfImage = (vault: Vault, image: TFile) => {
  return vault.getResourcePath(image);
};

const detectWikiInternalLink = (lineText: string): LinkMatch | null => {
  const { metadataCache, vault } = appStore.getState().dailyNotesState.app;
  const internalFileName = WIKI_IMAGE_URL_REG.exec(lineText)?.[1];
  const internalAltName = WIKI_IMAGE_URL_REG.exec(lineText)?.[5];
  const file = metadataCache.getFirstLinkpathDest(decodeURIComponent(internalFileName), '');

  if (file === null) {
    return {
      linkText: internalFileName,
      altText: internalAltName,
      path: '',
      filePath: '',
    };
  } else {
    const imagePath = getPathOfImage(vault, file);
    if (internalAltName) {
      return {
        linkText: internalFileName,
        altText: internalAltName,
        path: imagePath,
        filePath: file.path,
      };
    } else {
      return {
        linkText: internalFileName,
        altText: '',
        path: imagePath,
        filePath: file.path,
      };
    }
  }
};

const detectMDInternalLink = (lineText: string): LinkMatch | null => {
  const { metadataCache, vault } = appStore.getState().dailyNotesState.app;
  const internalFileName = MARKDOWN_URL_REG.exec(lineText)?.[5];
  const internalAltName = MARKDOWN_URL_REG.exec(lineText)?.[2];
  const file = metadataCache.getFirstLinkpathDest(decodeURIComponent(internalFileName), '');

  if (file === null) {
    return {
      linkText: internalFileName,
      altText: internalAltName,
      path: '',
      filePath: '',
    };
  } else {
    const imagePath = getPathOfImage(vault, file);
    if (internalAltName) {
      return {
        linkText: internalFileName,
        altText: internalAltName,
        path: imagePath,
        filePath: file.path,
      };
    } else {
      return {
        linkText: internalFileName,
        altText: '',
        path: imagePath,
        filePath: file.path,
      };
    }
  }
};

const ShareMemoImageDialog: React.FC<Props> = (props: Props) => {
  const { memo: propsMemo, destroy } = props;
  const { memos } = appStore.getState().memoState;
  let memosLength;
  let createdDays;
  if (memos.length) {
    memosLength = memos.length - 1;
    createdDays = memos
      ? Math.ceil((Date.now() - utils.getTimeStampByDate(memos[memosLength].createdAt)) / 1000 / 3600 / 24)
      : 0;
  }
  // const { user: userinfo } = userService.getState();
  const memo: FormattedMemo = {
    ...propsMemo,
    createdAtStr: utils.getDateTimeString(propsMemo.createdAt),
  };
  // const memoImgUrls = Array.from(memo.content.match(IMAGE_URL_REG) ?? []);
  // const memosNum = memos.length;

  const footerEnd = ShareFooterEnd.replace('{UserName}', UserName);
  const footerStart = ShareFooterStart.replace('{MemosNum}', memos.length.toString()).replace(
    '{UsedDay}',
    createdDays.toString(),
  );

  let externalImageUrls = [] as string[];
  const internalImageUrls = [];
  let allMarkdownLink: string | any[] = [];
  let allInternalLink = [] as any[];
  if (new RegExp(IMAGE_URL_REG).test(memo.content)) {
    let allExternalImageUrls = [] as string[];
    const anotherExternalImageUrls = [] as string[];
    if (new RegExp(MARKDOWN_URL_REG).test(memo.content)) {
      allMarkdownLink = Array.from(memo.content.match(MARKDOWN_URL_REG));
    }
    if (new RegExp(WIKI_IMAGE_URL_REG).test(memo.content)) {
      allInternalLink = Array.from(memo.content.match(WIKI_IMAGE_URL_REG));
    }
    // const allInternalLink = Array.from(memo.content.match(WIKI_IMAGE_URL_REG));
    if (new RegExp(MARKDOWN_WEB_URL_REG).test(memo.content)) {
      allExternalImageUrls = Array.from(memo.content.match(MARKDOWN_WEB_URL_REG));
    }
    if (allInternalLink.length) {
      for (let i = 0; i < allInternalLink.length; i++) {
        const allInternalLinkElement = allInternalLink[i];
        internalImageUrls.push(detectWikiInternalLink(allInternalLinkElement));
      }
    }
    if (allMarkdownLink.length) {
      for (let i = 0; i < allMarkdownLink.length; i++) {
        const allMarkdownLinkElement = allMarkdownLink[i];
        if (/(.*)http[s]?(.*)/.test(allMarkdownLinkElement)) {
          anotherExternalImageUrls.push(MARKDOWN_URL_REG.exec(allMarkdownLinkElement)?.[5]);
        } else {
          internalImageUrls.push(detectMDInternalLink(allMarkdownLinkElement));
        }
      }
    }
    externalImageUrls = allExternalImageUrls.concat(anotherExternalImageUrls);
    // externalImageUrls = Array.from(memo.content.match(IMAGE_URL_REG) ?? []);
  }

  const [shortcutImgUrl, setShortcutImgUrl] = useState('');
  const [imgAmount, setImgAmount] = useState(externalImageUrls.length);
  const memoElRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (imgAmount > 0) {
      return;
    }

    changeBackgroundImage();

    setTimeout(() => {
      if (!memoElRef.current) {
        return;
      }

      let shareDialogBackgroundColor;

      if (document.body.className.contains('theme-dark')) {
        shareDialogBackgroundColor = '#727171';
      } else {
        shareDialogBackgroundColor = '#eaeaea';
      }

      toImage(memoElRef.current, {
        backgroundColor: shareDialogBackgroundColor,
        pixelRatio: window.devicePixelRatio * 2,
      })
        .then((url) => {
          setShortcutImgUrl(url);
        })
        .catch(() => {
          // do nth
        });
    }, ANIMATION_DURATION);
  }, [imgAmount]);

  const handleCloseBtnClick = () => {
    destroy();
  };

  const convertBase64ToBlob = (base64: string, type: string) => {
    const bytes = window.atob(base64);
    const ab = new ArrayBuffer(bytes.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < bytes.length; i++) {
      ia[i] = bytes.charCodeAt(i);
    }
    return new Blob([ab], { type: type });
  };

  const convertBackgroundToBase64 = async (path: string): Promise<string> => {
    const { vault } = dailyNotesService.getState().app;
    const buffer = await vault.adapter.readBinary(path);
    const arr = new Uint8Array(buffer);

    const blob = new Blob([arr], { type: 'image/png' });

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Url = reader.result as string;
        // cachedResourceMap.set(url, base64Url);
        resolve(base64Url);
      };
      reader.readAsDataURL(blob);
    });
  };

  const changeBackgroundImage = async () => {
    const { app } = dailyNotesService.getState();
    let imageUrl;
    let imagePath;
    const lightBackgroundImage = encodeURI(lightBackground);
    const darkBackgroundImage = encodeURI(darkBackground);
    if (document.body.className.contains('theme-light')) {
      if (
        (await app.vault.adapter.exists(DefaultLightBackgroundImage)) &&
        /\.(png|svg|jpg|jpeg)/g.test(DefaultLightBackgroundImage)
      ) {
        imagePath = DefaultLightBackgroundImage;
        imageUrl = await convertBackgroundToBase64(imagePath);
      } else {
        imageUrl = lightBackgroundImage;
      }
    } else if (document.body.className.contains('theme-dark')) {
      if (
        (await app.vault.adapter.exists(DefaultDarkBackgroundImage)) &&
        /\.(png|svg|jpg|jpeg)/g.test(DefaultDarkBackgroundImage)
      ) {
        imagePath = DefaultDarkBackgroundImage;
        imageUrl = await convertBackgroundToBase64(imagePath);
      } else {
        imageUrl = darkBackgroundImage;
      }
    }
    const memoShareDiv = document.querySelector('.dialog-wrapper .memo-background .property-image') as HTMLElement;
    memoShareDiv.style.backgroundImage = "url('" + imageUrl + "')";
    if (document.body.className.contains('theme-dark')) {
      memoShareDiv.style.backgroundColor = '#1f1f1f';
    }
  };

  const handleCopytoClipboardBtnClick = async () => {
    const { vault } = appStore.getState().dailyNotesState.app;
    const divs = document.querySelector('.memo-shortcut-img') as HTMLElement;
    const myBase64 = divs.getAttribute('src').split('base64,')[1];
    const blobInput = convertBase64ToBlob(myBase64, 'image/png');
    let aFile: TFile;
    let newFile;
    if (AutoSaveWhenOnMobile && Platform.isMobile) {
      blobInput.arrayBuffer().then(async (buffer) => {
        const ext = 'png';
        const dailyNotes = utils.getAllDailyNotes();
        for (const string in dailyNotes) {
          if (dailyNotes[string] instanceof TFile) {
            aFile = dailyNotes[string];
            break;
          }
        }
        if (aFile !== undefined) {
          newFile = await vault.createBinary(
            //@ts-expect-error, private method
            await vault.getAvailablePathForAttachments(`Pasted Image ${moment().format('YYYYMMDDHHmmss')}`, ext, aFile),
            buffer,
          );
        }
      });
    }
    const clipboardItemInput = new ClipboardItem({ 'image/png': blobInput });
    window.navigator['clipboard'].write([clipboardItemInput]);
    new Notice('Send to clipboard successfully');
  };

  const handleImageOnLoad = (ev: React.SyntheticEvent<HTMLImageElement>) => {
    if (ev.type === 'error') {
      new Notice(t('Image load failed'));
      (ev.target as HTMLImageElement).remove();
    }
    setImgAmount(imgAmount - 1);
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">
          <span className="icon-text">🥰</span>
          {t('Share Memo Image')}
        </p>
        <div className="btn-group">
          <button className="btn copy-btn" onClick={handleCopytoClipboardBtnClick}>
            <Share className="icon-img" />
          </button>
          <button className="btn close-btn" onClick={handleCloseBtnClick}>
            <Close className="icon-img" />
          </button>
        </div>
      </div>
      <div className="dialog-content-container">
        <div className={`tip-words-container ${shortcutImgUrl ? 'finish' : 'loading'}`}>
          <p className="tip-text">{shortcutImgUrl ? t('↗Click the button to save') : t('Image is generating...')}</p>
        </div>
        <div className="memo-container" ref={memoElRef}>
          <Only when={shortcutImgUrl !== ''}>
            <img className="memo-shortcut-img" src={shortcutImgUrl} />
          </Only>
          <div className="memo-background">
            <div
              className="property-image"
              style={{
                backgroundSize: 'cover',
                backgroundRepeat: 'no-repeat',
              }}
            ></div>
            {/* <span className="time-text">{memo.createdAtStr}</span> */}
            <span className="background-container"></span>
            <div
              className="memo-content-text"
              dangerouslySetInnerHTML={{ __html: formatMemoContent(memo.content) }}
            ></div>
            <Only when={externalImageUrls.length > 0}>
              <div className="images-container">
                {externalImageUrls.map((imgUrl, idx) => (
                  <img
                    // crossOrigin="anonymous"
                    // decoding="async"
                    key={idx}
                    src={imgUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    onLoad={handleImageOnLoad}
                    onError={handleImageOnLoad}
                  />
                ))}
              </div>
            </Only>
            <Only when={internalImageUrls.length > 0}>
              <div className="images-container internal-embed image-embed is-loaded">
                {internalImageUrls.map((imgUrl, idx) => (
                  <img key={idx} className="memo-img" src={imgUrl.path} alt={imgUrl.altText} path={imgUrl.filePath} />
                ))}
              </div>
            </Only>
            <div className="watermark-container">
              <span className="normal-text footer-start">
                <div className="property-social-icons"></div>
                <span className="name-text">{footerStart}</span>
              </span>
              <span className="normal-text footer-end">
                <span className="name-text">{footerEnd}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default function showShareMemoImageDialog(memo: Model.Memo): void {
  showDialog(
    {
      className: 'share-memo-image-dialog',
    },
    ShareMemoImageDialog,
    { memo },
  );
}
