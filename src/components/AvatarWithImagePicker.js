import _ from 'underscore';
import React, {useState, useRef, useEffect} from 'react';
import {View} from 'react-native';
import PropTypes from 'prop-types';
import lodashGet from 'lodash/get';
import Avatar from './Avatar';
import Icon from './Icon';
import PopoverMenu from './PopoverMenu';
import * as Expensicons from './Icon/Expensicons';
import styles from '../styles/styles';
import themeColors from '../styles/themes/default';
import AttachmentPicker from './AttachmentPicker';
import AvatarCropModal from './AvatarCropModal/AvatarCropModal';
import OfflineWithFeedback from './OfflineWithFeedback';
import withLocalize, {withLocalizePropTypes} from './withLocalize';
import variables from '../styles/variables';
import CONST from '../CONST';
import SpinningIndicatorAnimation from '../styles/animation/SpinningIndicatorAnimation';
import Tooltip from './Tooltip';
import stylePropTypes from '../styles/stylePropTypes';
import * as FileUtils from '../libs/fileDownload/FileUtils';
import getImageResolution from '../libs/fileDownload/getImageResolution';
import PressableWithoutFeedback from './Pressable/PressableWithoutFeedback';
import AttachmentModal from './AttachmentModal';
import DotIndicatorMessage from './DotIndicatorMessage';
import * as Browser from '../libs/Browser';
import withNavigationFocus, {withNavigationFocusPropTypes} from './withNavigationFocus';
import compose from '../libs/compose';

const propTypes = {
    /** Avatar source to display */
    source: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),

    /** Additional style props */
    style: stylePropTypes,

    /** Executed once an image has been selected */
    onImageSelected: PropTypes.func,

    /** Execute when the user taps "remove" */
    onImageRemoved: PropTypes.func,

    /** A default avatar component to display when there is no source */
    DefaultAvatar: PropTypes.func,

    /** Whether we are using the default avatar */
    isUsingDefaultAvatar: PropTypes.bool,

    /** The anchor position of the menu */
    anchorPosition: PropTypes.shape({
        top: PropTypes.number,
        right: PropTypes.number,
        bottom: PropTypes.number,
        left: PropTypes.number,
    }).isRequired,

    /** Flag to see if image is being uploaded */
    isUploading: PropTypes.bool,

    /** Size of Indicator */
    size: PropTypes.oneOf([CONST.AVATAR_SIZE.LARGE, CONST.AVATAR_SIZE.DEFAULT]),

    /** A fallback avatar icon to display when there is an error on loading avatar from remote URL. */
    fallbackIcon: PropTypes.oneOfType([PropTypes.func, PropTypes.string]),

    /** Denotes whether it is an avatar or a workspace avatar */
    type: PropTypes.oneOf([CONST.ICON_TYPE_AVATAR, CONST.ICON_TYPE_WORKSPACE]),

    /** Image crop vector mask */
    editorMaskImage: PropTypes.func,

    /** Additional style object for the error row */
    errorRowStyles: stylePropTypes,

    /** A function to run when the X button next to the error is clicked */
    onErrorClose: PropTypes.func,

    /** The type of action that's pending  */
    pendingAction: PropTypes.oneOf(['add', 'update', 'delete']),

    /** The errors to display  */
    // eslint-disable-next-line react/forbid-prop-types
    errors: PropTypes.object,

    /** Title for avatar preview modal */
    headerTitle: PropTypes.string,

    /** Avatar source for avatar preview modal */
    previewSource: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),

    /** File name of the avatar */
    originalFileName: PropTypes.string,

    ...withLocalizePropTypes,
    ...withNavigationFocusPropTypes,
};

const defaultProps = {
    source: '',
    onImageSelected: () => {},
    onImageRemoved: () => {},
    style: [],
    DefaultAvatar: () => {},
    isUsingDefaultAvatar: false,
    isUploading: false,
    size: CONST.AVATAR_SIZE.DEFAULT,
    fallbackIcon: Expensicons.FallbackAvatar,
    type: CONST.ICON_TYPE_AVATAR,
    editorMaskImage: undefined,
    errorRowStyles: [],
    onErrorClose: () => {},
    pendingAction: null,
    errors: null,
    headerTitle: '',
    previewSource: '',
    originalFileName: '',
};

function AvatarWithImagePicker({ 
    isUploading, 
    isFocused, 
    DefaultAvatar, 
    style, 
    pendingAction, 
    errors, 
    errorRowStyles, 
    onErrorClose, 
    translate, 
    source, 
    fallbackIcon, 
    size, 
    type, 
    headerTitle, 
    previewSource, 
    originalFileName, 
    isUsingDefaultAvatar, 
    onImageRemoved, 
    anchorPosition, 
    anchorAlignment, 
    onImageSelected, 
    editorMaskImage  }) {

    const animation = useRef(new SpinningIndicatorAnimation()).current;
    const [isMenuVisible, setIsMenuVisible] = useState(false);
    const [validationError, setValidationError] = useState(null);
    const [phraseParam, setPhraseParam] = useState({});
    const [isAvatarCropModalOpen, setIsAvatarCropModalOpen] = useState(false);
    const [imageName, setImageName] = useState('');
    const [imageUri, setImageUri] = useState('');
    const [imageType, setImageType] = useState('');
    const anchorRef = useRef();

    useEffect(() => {
        if (isUploading) {
            animation.start();
        }
        
        return () => {
            animation.stop();
        };
    }, [isUploading]);

    useEffect(() => {
        // check if the component is no longer focused, then reset the error.
        if (!isFocused) {
            setError(null, {});
        }
    }, [isFocused]);

    const setError = (error, phraseParam) => {
        setValidationError(error);
        setPhraseParam(phraseParam);
    };

    /**
     * Check if the attachment extension is allowed.
     *
     * @param {Object} image
     * @returns {Boolean}
     */
    const isValidExtension = (image) => {
        const { fileExtension } = FileUtils.splitExtensionFromFileName(lodashGet(image, 'name', ''));
        return _.contains(CONST.AVATAR_ALLOWED_EXTENSIONS, fileExtension.toLowerCase());
    };

     /**
     * Check if the attachment size is less than allowed size.
     *
     * @param {Object} image
     * @returns {Boolean}
     */
    const isValidSize = (image) => {
        return image && lodashGet(image, 'size', 0) < CONST.AVATAR_MAX_ATTACHMENT_SIZE;
    };

    /**
     * Check if the attachment resolution matches constraints.
     *
     * @param {Object} image
     * @returns {Promise}
     */
    const isValidResolution = async (image) => {
        const resolution = await getImageResolution(image);
        return resolution.height >= CONST.AVATAR_MIN_HEIGHT_PX &&
            resolution.width >= CONST.AVATAR_MIN_WIDTH_PX &&
            resolution.height <= CONST.AVATAR_MAX_HEIGHT_PX &&
            resolution.width <= CONST.AVATAR_MAX_WIDTH_PX;
    };

    /**
     * Validates if an image has a valid resolution and opens an avatar crop modal
     *
     * @param {Object} image
     */
    const showAvatarCropModal = async (image) => {
        if (!isValidExtension(image)) {
            setError('avatarWithImagePicker.notAllowedExtension', { allowedExtensions: CONST.AVATAR_ALLOWED_EXTENSIONS });
            return;
        }
        if (!isValidSize(image)) {
            setError('avatarWithImagePicker.sizeExceeded', { maxUploadSizeInMB: CONST.AVATAR_MAX_ATTACHMENT_SIZE / (1024 * 1024) });
            return;
        }

        const isValidRes = await isValidResolution(image);
        if (!isValidRes) {
            setError('avatarWithImagePicker.resolutionConstraints', {
                minHeightInPx: CONST.AVATAR_MIN_HEIGHT_PX,
                minWidthInPx: CONST.AVATAR_MIN_WIDTH_PX,
                maxHeightInPx: CONST.AVATAR_MAX_HEIGHT_PX,
                maxWidthInPx: CONST.AVATAR_MAX_WIDTH_PX,
            });
            return;
        }

        setIsAvatarCropModalOpen(true);
        setValidationError(null);
        setPhraseParam({});
        setIsMenuVisible(false);
        setImageUri(image.uri);
        setImageName(image.name);
        setImageType(image.type);
    };

    const hideAvatarCropModal = () => {
        setIsAvatarCropModalOpen(false);
    };

    const additionalStyles = _.isArray(style) ? style : [style];

    return (
        <View style={[styles.alignItemsCenter, ...additionalStyles]}>
                            <View style={[styles.pRelative, styles.avatarLarge]}>
                    <OfflineWithFeedback
                        pendingAction={pendingAction}
                        errors={errors}
                        errorRowStyles={errorRowStyles}
                        onClose={onErrorClose}
                    >
                        <Tooltip text={translate('avatarWithImagePicker.editImage')}>
                            <PressableWithoutFeedback
                                onPress={() => setIsMenuVisible(prev => !prev)}
                                accessibilityRole={CONST.ACCESSIBILITY_ROLE.IMAGEBUTTON}
                                accessibilityLabel={translate('avatarWithImagePicker.editImage')}
                                disabled={isAvatarCropModalOpen}
                                ref={anchorRef}
                            >
                                <View>
                                    {source ? (
                                        <Avatar
                                            containerStyles={styles.avatarLarge}
                                            imageStyles={[styles.avatarLarge, styles.alignSelfCenter]}
                                            source={source}
                                            fallbackIcon={fallbackIcon}
                                            size={size}
                                            type={type}
                                        />
                                    ) : (
                                        <DefaultAvatar />
                                    )}
                                </View>
                                <View style={[styles.smallEditIcon, styles.smallAvatarEditIcon]}>
                                    <Icon
                                        src={Expensicons.Camera}
                                        width={variables.iconSizeSmall}
                                        height={variables.iconSizeSmall}
                                        fill={themeColors.textLight}
                                    />
                                </View>
                            </PressableWithoutFeedback>
                        </Tooltip>
                    </OfflineWithFeedback>
                    <AttachmentModal
                        headerTitle={headerTitle}
                        source={previewSource}
                        originalFileName={originalFileName}
                        fallbackSource={fallbackIcon}
                    >
                        {({show}) => (
                            <AttachmentPicker type={CONST.ATTACHMENT_PICKER_TYPE.IMAGE}>
                                {({openPicker}) => {
                                    const menuItems = [
                                        {
                                            icon: Expensicons.Upload,
                                            text: translate('avatarWithImagePicker.uploadPhoto'),
                                            onSelected: () => {
                                                if (Browser.isSafari()) {
                                                    return;
                                                }
                                                openPicker({
                                                    onPicked: showAvatarCropModal,
                                                });
                                            },
                                        },
                                    ];

                                    // If current avatar isn't a default avatar, allow Remove Photo option
                                    if (!isUsingDefaultAvatar) {
                                        menuItems.push({
                                            icon: Expensicons.Trashcan,
                                            text: translate('avatarWithImagePicker.removePhoto'),
                                            onSelected: () => {
                                                setError(null, {});
                                                onImageRemoved();
                                            },
                                        });

                                        menuItems.push({
                                            icon: Expensicons.Eye,
                                            text: translate('avatarWithImagePicker.viewPhoto'),
                                            onSelected: () => show(),
                                        });
                                    }
                                    return (
                                        <PopoverMenu
                                            isVisible={isMenuVisible}
                                            onClose={() => setIsMenuVisible(false)}
                                            onItemSelected={(item, index) => {
                                                setIsMenuVisible(false);
                                                // In order for the file picker to open dynamically, the click
                                                // function must be called from within a event handler that was initiated
                                                // by the user on Safari.
                                                if (index === 0 && Browser.isSafari()) {
                                                    openPicker({
                                                        onPicked: showAvatarCropModal,
                                                    });
                                                }
                                            }}
                                            menuItems={menuItems}
                                            anchorPosition={anchorPosition}
                                            withoutOverlay
                                            anchorRef={anchorRef}
                                            anchorAlignment={anchorAlignment}
                                        />
                                    );
                                }}
                            </AttachmentPicker>
                        )}
                    </AttachmentModal>
                </View>
                {validationError && (
                    <DotIndicatorMessage
                        style={[styles.mt6]}
                        messages={{0: translate(validationError, phraseParam)}}
                        type="error"
                    />
                )}
                <AvatarCropModal
                    onClose={hideAvatarCropModal}
                    isVisible={isAvatarCropModalOpen}
                    onSave={onImageSelected}
                    imageUri={imageUri}
                    imageName={imageName}
                    imageType={imageType}
                    maskImage={editorMaskImage}
                />
        </View>
    );
}

AvatarWithImagePicker.propTypes = propTypes;
AvatarWithImagePicker.defaultProps = defaultProps;

export default compose(withLocalize, withNavigationFocus)(AvatarWithImagePicker);
