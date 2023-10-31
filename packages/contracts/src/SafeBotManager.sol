// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;
import {SMOtpValidator} from "./SMOtpValidator.sol";
import {ERC20, Enum, Safe, SafeFactory, Guard}  from "./Interfaces.sol";

contract SafeBotManager is Guard {

    ///////////////////////////////////////////////////////////////////////////////
    ///                                  IMMUTABLES                             ///
    ///////////////////////////////////////////////////////////////////////////////

    SMOtpValidator immutable otpValidator;
    SafeFactory immutable safeFactory;
    address immutable safeSingleton;

    ///////////////////////////////////////////////////////////////////////////////
    ///                                  MAPPINGS                               ///
    ///////////////////////////////////////////////////////////////////////////////

    mapping (Safe => bytes32) public root;
    mapping (address => Safe) public safe;
    mapping (address => address) public safeOwner;
    mapping (Safe => address) public safeRecovery;
    mapping (Safe => mapping (bytes32 => bool)) invalidOtp;
    // safe -> target -> function -> bool
    mapping (Safe => mapping (address => mapping (bytes4 => bool))) approvedTarget;
    mapping (Safe => mapping (address => mapping (address => bool))) approvedTokenRecipient;
    
    ///////////////////////////////////////////////////////////////////////////////
    ///                                   STRUCTS                               ///
    /////////////////////////////////////////////////////////////////////////////// 

    struct OtpData {
        bytes proof;
        bytes32 otp;
    }

    struct TargetData {
        address target;
        bytes4[] targetFunc;
        address[] tokenRecipients;
    }

    ///////////////////////////////////////////////////////////////////////////////
    ///                                    EVENTS                               ///
    ///////////////////////////////////////////////////////////////////////////////

    event TargetsApproved(Safe indexed safe, TargetData[] targetData);
    event TargetsRevoked(Safe indexed safe, TargetData[] targetData);
    event OtpRootSet(Safe indexed safe, bytes32 root);
    event SafeCreatedAndSetup(Safe indexed safe, address safeOwner);
    event SafeSetup(Safe indexed safe, address safeOwner);
    event SafeRecoverySetup(Safe indexed safe, address recoveryAddress);
    event SafeRecovered(Safe indexed safe, address safeRecoveryAddress, address newOwner);

    ///////////////////////////////////////////////////////////////////////////////
    ///                                 CONSTRUCTOR                             ///
    ///////////////////////////////////////////////////////////////////////////////

    constructor(address _otpValidator, address _safeFactory, address singleton) {
        otpValidator = SMOtpValidator(_otpValidator);
        safeFactory = SafeFactory(_safeFactory);
        safeSingleton = singleton;
    }

    ///////////////////////////////////////////////////////////////////////////////
    ///                                    SETUP                                ///
    ///////////////////////////////////////////////////////////////////////////////

    function setupSafe(
        Safe _safe, 
        address _recoveryAddress, 
        TargetData[] memory _targetData,
        bytes32 _root,
        OtpData memory otpData
    ) external {
        require(_safe.isModuleEnabled(address(this)), "Module_Not_Enabled");
        require(address(_getSafe()) ==  address(0), "Safe_Already_Setup");
        safe[msg.sender] = _safe;
        _setupOTP(_safe, _root, otpData);
        _setupSafeRecovery(_safe, _recoveryAddress);

        if(_targetData.length != 0){
            _approveTargets(_safe, _targetData);
        }

        emit SafeSetup(_safe, msg.sender);
    }


    function createAndSetupSafe(
        bytes32 _root, 
        address _recoveryAddress, 
        TargetData[] memory _defaultTargetData,
        OtpData memory otpData,
        address fallbackHandler,
        address paymentToken,
        uint256 payment,
        address payable paymentReceiver
    ) external {
        require(address(_getSafe()) == address(0), "Safe_Already_Setup");
        //create safe and add module
        bytes memory data = abi.encodeWithSelector(Safe.enableModule.selector, address(this));
        Safe _safe = safeFactory.createProxy(safeSingleton, data);

        {
            address[] memory _owners = new address[](1);
            _owners[0] = msg.sender;
            //setup safe
            _safe.setup(
                _owners,
                1,
                address(0),
                "0x",
                fallbackHandler,
                paymentToken,
                payment,
                paymentReceiver
            );
        }
        require(_safe.isModuleEnabled(address(this)), "Module_Not_Enabled");

        _setupOTP(_safe, _root, otpData);
        safe[msg.sender] = _safe;

        if(_defaultTargetData.length != 0){
            _approveTargets(_safe, _defaultTargetData);
        }
        //set Guard
        data = abi.encodeWithSelector(Safe.setGuard.selector, address(this));
        _safe.execTransactionFromModule(
            address(_safe),
            0,
            data,
            Enum.Operation.Call
        );
        _setupSafeRecovery(_safe, _recoveryAddress);

        emit SafeCreatedAndSetup(_safe, msg.sender);
    }

    ///////////////////////////////////////////////////////////////////////////////
    ///                                 RECOVERY                                ///
    ///////////////////////////////////////////////////////////////////////////////

    function recoverSafe(Safe _safe, address _newManager, address _prevManager, OtpData memory otpData) public {
        address _recoveryAddress = safeRecovery[_safe];
        require(_recoveryAddress == msg.sender, "Not_Recovery_Address");
        require(_safe == safe[_prevManager], "Not_Manager");
        _validateOtp(_safe, otpData);
        {
            bytes memory data;
            //swapOner
            // Todo
            // _safe.execTransactionFromModule();
            //remove guard
            data = abi.encodeWithSelector(Safe.setGuard.selector, address(0));
            _safe.execTransactionFromModule(
                address(_safe),
                0,
                data,
                Enum.Operation.Call
            );
            if(_safe.isModuleEnabled(address(this))){
                //disable module
                data = abi.encodeWithSelector(Safe.disableModule.selector, address(this));
                _safe.execTransactionFromModule(
                    address(_safe),
                    0,
                    data,
                    Enum.Operation.Call
                );
            }
            require(!_safe.isModuleEnabled(address(this)), "Module_Not_Disabled");  
        }

        delete safe[_prevManager];
        delete root[_safe];
        delete safeRecovery[_safe];

        emit SafeRecovered(_safe, _recoveryAddress, _newManager);
    }

    function _setupSafeRecovery(Safe _safe, address recoveryAddress) internal {
        safeRecovery[_safe] = recoveryAddress;
        emit  SafeRecoverySetup(_safe, recoveryAddress);
    }

    ///////////////////////////////////////////////////////////////////////////////
    ///                                  MODULE                                 ///
    ///////////////////////////////////////////////////////////////////////////////

    function executeSafeTxWithOtp(
        address to,
        uint256 value,
        bytes memory data,
        OtpData memory otpData
    ) external {
        Safe _safe = _getSafe();
        _validateOtp(_safe, otpData);
        _safe.execTransactionFromModule(
            to,
            value,
            data,
            Enum.Operation.Call
        );
    }

    function executeSafeTxWithoutOtp(
        address to,
        uint256 value,
        bytes memory data
    ) external {
        Safe _safe = _getSafe();
        _checkTx(_safe, to, data);
        _safe.execTransactionFromModule(
            to,
            value,
            data,
            Enum.Operation.Call
        );
    }

    ///////////////////////////////////////////////////////////////////////////////
    ///                                   GUARD                                 ///
    ///////////////////////////////////////////////////////////////////////////////

    function _checkTx(Safe _safe, address to, bytes memory data) internal view {
        //Only approved txs
        _notSafe(_safe, to);

        bytes4 selector;
        address receiver;
        assembly {
            selector := shr(mload(add(mload(data),0x20)), 224)
        }
        require(approvedTarget[_safe][to][selector], "Target_Not_Approved");
        if(selector == ERC20.transfer.selector){
            assembly {
                //Todo
                receiver := mload(add(mload(data),0x20))
            }
            require(approvedTokenRecipient[_safe][to][receiver], "Recipient_Not_Approved");
        } else if (selector == ERC20.transferFrom.selector){
            // Todo
            //receiver =  address(data[36:68]);
             require(approvedTokenRecipient[_safe][to][receiver], "Recipient_Not_Approved");
        }
    }

    function checkTransaction(
        address to,
        uint256 /* value */,
        bytes memory data,
        Enum.Operation operation,
        uint256 /* safeTxGas */,
        uint256 /* baseGas */,
        uint256 /* gasPrice */,
        address /*  gasToken */,
        address payable /* refundReceiver */,
        bytes memory /* signatures */,
        address /* msgSender */
    ) external override {
        //No delegate Call
        require(operation != Enum.Operation.DelegateCall);
        _checkTx(Safe(msg.sender), to, data);
    }

    function checkAfterExecution(bytes32 txHash, bool success) external override {}

    ///////////////////////////////////////////////////////////////////////////////
    ///                                  APPROVAL                               ///
    ///////////////////////////////////////////////////////////////////////////////

    function _approveTargets(Safe _safe, TargetData[] memory targetData) internal {
        require(targetData.length != 0, "Empty_Target");
        _toggleApproval(_safe, targetData, true);
        emit TargetsApproved(_safe, targetData);
    }
    function approveTargets(TargetData[] memory targetData, OtpData memory otpData) external {
        Safe _safe = _getSafe();
        _isValidSafe(_safe);
        _validateOtp(_safe, otpData);
        _approveTargets(_safe, targetData);
    }

    function revokeTargets(TargetData[] memory targetData, OtpData memory otpData) external {
        require(targetData.length != 0, "Empty_Target");
        Safe _safe = _getSafe();
        _isValidSafe(_safe);
        _validateOtp(_safe, otpData);
        _toggleApproval(_safe, targetData, false);
        emit TargetsRevoked(_safe, targetData);
    }

    function _toggleApproval(Safe _safe, TargetData[] memory targetData, bool _toggle) internal {
        for(uint256 i = 0; i < targetData.length; i++){
            address _targetAddr = targetData[i].target;
            bytes4[] memory _targetFuncs = targetData[i].targetFunc;
            for(uint256 j = 0; i < targetData.length; i++){
                approvedTarget[_safe][_targetAddr][_targetFuncs[i]] = _toggle;
            }
            address[] memory tokenRecipients = targetData[i].tokenRecipients;
            for(uint256 k = 0; i < tokenRecipients.length; i++){
                approvedTokenRecipient[_safe][_targetAddr][tokenRecipients[k]] = _toggle;
            }
        }
    }

    ///////////////////////////////////////////////////////////////////////////////
    ///                             TWO FACTOR AUTH                             ///
    ///////////////////////////////////////////////////////////////////////////////

    function _validateOtp(Safe _safe, OtpData memory otpData) internal {
        require(!invalidOtp[_safe][otpData.otp], "Invalid_Otp");
        require(otpValidator.verifyOtp(otpData.proof, root[_safe], otpData.otp, block.timestamp), "Otp_Validation_Unsuccessful");
        invalidOtp[_safe][otpData.otp] = true;
    }

    function _setupOTP(Safe _safe, bytes32 _root, OtpData memory otpData) internal {
         root[_safe] = _root;
         _validateOtp(_safe, otpData);
         emit OtpRootSet(_safe, _root);
    }

    ///////////////////////////////////////////////////////////////////////////////
    ///                                 HELPERS                                 ///
    ///////////////////////////////////////////////////////////////////////////////

    function _getSafe() internal view returns(Safe) {
        return safe[msg.sender];
    }

    function _notSafe(Safe _safe, address to) internal pure {
        require(to != address(_safe), "Invalid_Call_Dest");
    }

    function _isValidSafe(Safe _safe) internal pure {
        require(address(_safe) != address(0), "Safe_Not_Setup");
    }

}